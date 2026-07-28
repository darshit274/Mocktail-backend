const ErrorHandler = require('../../utils/default/errorHandler');
const { Question, Test, TestSeries, ExamCategory, QuestionImport } = require('../../models');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/question_imports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'questions-' + uniqueSuffix + extension);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
      'application/csv', // .csv alternative
      'text/plain', // .csv sometimes detected as text/plain
      'application/octet-stream' // .csv often detected as octet-stream
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
    }
  }
});

// Helper function to generate and send template
const generateAndSendTemplate = async (req, res, next, format) => {
    try {
        // console.log(`📊 Starting template generation for format: ${format}`);

        // Create sample data for template
        const sampleData = [
            {
                'Question Text (English)': 'What is the capital of Gujarat?',
                'Question Text (Gujarati)': 'ગુજરાતની રાજધાની કઈ છે?',
                'Option A (English)': 'Ahmedabad',
                'Option A (Gujarati)': 'અમદાવાદ',
                'Option B (English)': 'Gandhinagar',
                'Option B (Gujarati)': 'ગાંધીનગર',
                'Option C (English)': 'Surat',
                'Option C (Gujarati)': 'સુરત',
                'Option D (English)': 'Rajkot',
                'Option D (Gujarati)': 'રાજકોટ',
                'Correct Answer': 'B',
                'Explanation (English)': 'Gandhinagar is the capital of Gujarat state.',
                'Explanation (Gujarati)': 'ગાંધીનગર ગુજરાત રાજ્યની રાજધાની છે.',
                'Marks': 1
            },
            {
                'Question Text (English)': 'Sample question 2 - Delete this row',
                'Question Text (Gujarati)': 'નમૂનો પ્રશ્ન 2 - આ પંક્તિ કાઢી નાખો',
                'Option A (English)': 'Option 1',
                'Option A (Gujarati)': 'વિકલ્પ 1',
                'Option B (English)': 'Option 2',
                'Option B (Gujarati)': 'વિકલ્પ 2',
                'Option C (English)': 'Option 3',
                'Option C (Gujarati)': 'વિકલ્પ 3',
                'Option D (English)': 'Option 4',
                'Option D (Gujarati)': 'વિકલ્પ 4',
                'Correct Answer': 'A',
                'Explanation (English)': 'Sample explanation',
                'Explanation (Gujarati)': 'નમૂનો સમજૂતી',
                'Marks': 1
            }
        ];

        const XLSX = require('xlsx');
        
        if (format === 'csv') {
            // Generate CSV
            const worksheet = XLSX.utils.json_to_sheet(sampleData);
            const csv = XLSX.utils.sheet_to_csv(worksheet);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="questions_template.csv"');
            // console.log('✅ CSV template sent successfully');
            return res.send(csv);
        } else {
            // Generate Excel
            const worksheet = XLSX.utils.json_to_sheet(sampleData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
            
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="questions_template.xlsx"');
            // console.log('✅ Excel template sent successfully');
            return res.send(buffer);
        }

    } catch (error) {
        console.error('Template generation error:', error);
        return next(new ErrorHandler('Failed to generate template', 500));
    }
};

// Helper function to handle file imports
const handleFileImport = async (req, res, next) => {
    try {
        // console.log('📤 Starting file import process...');
        // console.log('📋 Request body:', req.body);
        // console.log('📁 Files:', req.files);

        if (!req.files || !req.files.file) {
            return next(new ErrorHandler('No file uploaded', 400));
        }

        const file = req.files.file;
        const categoryId = req.body.category_id;

        if (!categoryId) {
            return next(new ErrorHandler('Category ID is required', 400));
        }

        // console.log(`📄 Processing file: ${file.name}`);
        // console.log(`📂 Category ID: ${categoryId}`);

        // Determine file type
        const fileExtension = path.extname(file.name).toLowerCase();
        let fileType = '';
        
        if (fileExtension === '.xlsx' || fileExtension === '.xls') {
            fileType = 'excel';
        } else if (fileExtension === '.csv') {
            fileType = 'csv';
        } else {
            return next(new ErrorHandler('Invalid file type. Only Excel and CSV files are supported', 400));
        }

        // Save file temporarily
        const uploadDir = path.join(__dirname, '../../uploads/question_imports');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filename = `import-${Date.now()}-${Math.round(Math.random() * 1E9)}.${fileExtension.substr(1)}`;
        const filepath = path.join(uploadDir, filename);
        
        // Move uploaded file
        await file.mv(filepath);
        // console.log(`💾 File saved to: ${filepath}`);

        // Parse and validate file
        const parsedData = await parseImportFile(filepath, fileType);
        // console.log(`📊 Parsed ${parsedData.length} rows from file`);

        // Validate and convert to questions format
        const { validQuestions, errors } = await validateImportData(parsedData, categoryId);
        
        if (errors.length > 0) {
            // Clean up file
            fs.unlinkSync(filepath);
            return res.status(400).json({
                success: false,
                message: 'Validation errors found',
                errors: errors,
                total_rows: parsedData.length,
                valid_rows: validQuestions.length
            });
        }

        // Insert valid questions into database
        const createdQuestions = await Question.bulkCreate(validQuestions);
        
        // Clean up file
        fs.unlinkSync(filepath);

        // console.log(`✅ Successfully imported ${createdQuestions.length} questions`);

        res.status(201).json({
            success: true,
            message: `Successfully imported ${createdQuestions.length} questions`,
            data: {
                imported_count: createdQuestions.length,
                total_processed: parsedData.length,
                errors: errors
            }
        });

    } catch (error) {
        console.error('❌ File import error:', error);
        return next(new ErrorHandler(`Failed to import questions: ${error.message}`, 500));
    }
};

// Helper function to handle template downloads
const handleTemplateDownload = async (req, res, next) => {
    try {
        const format = req.query.template; // 'excel' or 'csv'
        
        if (!['excel', 'csv'].includes(format)) {
            return next(new ErrorHandler('Invalid template format. Use excel or csv', 400));
        }

        // console.log(`📊 Generating ${format.toUpperCase()} template...`);

        // Create sample data for template
        const sampleData = [
            {
                'Question Text (English)': 'What is the capital of Gujarat?',
                'Question Text (Gujarati)': 'ગુજરાતની રાજધાની કઈ છે?',
                'Option A (English)': 'Ahmedabad',
                'Option A (Gujarati)': 'અમદાવાદ',
                'Option B (English)': 'Gandhinagar',
                'Option B (Gujarati)': 'ગાંધીનગર',
                'Option C (English)': 'Surat',
                'Option C (Gujarati)': 'સુરત',
                'Option D (English)': 'Rajkot',
                'Option D (Gujarati)': 'રાજકોટ',
                'Correct Answer': 'B',
                'Explanation (English)': 'Gandhinagar is the capital of Gujarat state.',
                'Explanation (Gujarati)': 'ગાંધીનગર ગુજરાત રાજ્યની રાજધાની છે.',
                'Marks': 1
            },
            {
                'Question Text (English)': 'Sample question 2 - Delete this row',
                'Question Text (Gujarati)': 'નમૂનો પ્રશ્ન 2 - આ પંક્તિ કાઢી નાખો',
                'Option A (English)': 'Option 1',
                'Option A (Gujarati)': 'વિકલ્પ 1',
                'Option B (English)': 'Option 2',
                'Option B (Gujarati)': 'વિકલ્પ 2',
                'Option C (English)': 'Option 3',
                'Option C (Gujarati)': 'વિકલ્પ 3',
                'Option D (English)': 'Option 4',
                'Option D (Gujarati)': 'વિકલ્પ 4',
                'Correct Answer': 'A',
                'Explanation (English)': 'Sample explanation',
                'Explanation (Gujarati)': 'નમૂનો સમજૂતી',
                'Marks': 1
            }
        ];

        const XLSX = require('xlsx');
        
        if (format === 'csv') {
            // Generate CSV
            const worksheet = XLSX.utils.json_to_sheet(sampleData);
            const csv = XLSX.utils.sheet_to_csv(worksheet);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="questions_template.csv"');
            // console.log('✅ CSV template sent successfully');
            return res.send(csv);
        } else {
            // Generate Excel
            const worksheet = XLSX.utils.json_to_sheet(sampleData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
            
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="questions_template.xlsx"');
            // console.log('✅ Excel template sent successfully');
            return res.send(buffer);
        }

    } catch (error) {
        console.error('Template download error:', error);
        return next(new ErrorHandler('Failed to generate template', 500));
    }
};

// Get all questions with pagination and filters
exports.getQuestions = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const subject = req.query.subject || '';
        const difficulty = req.query.difficulty || '';
        const sortBy = req.query.sortBy || 'created_at';
        const sortOrder = req.query.sortOrder || 'DESC';

        const offset = (page - 1) * limit;

        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { question_text: { [Op.like]: `%${search}%` } },
                { topic: { [Op.like]: `%${search}%` } }
            ];
        }
        if (subject) {
            whereClause.subject = subject;
        }
        if (difficulty) {
            whereClause.difficulty = difficulty;
        }

        // Build order array - prioritize question_order if available
        const orderArray = [];
        if (sortBy === 'question_order' || sortBy === 'created_at') {
            // If sorting by question_order or created_at, use question_order first, then created_at
            orderArray.push(['question_order', 'ASC']);
            if (sortBy !== 'question_order') {
                orderArray.push([sortBy, sortOrder]);
            }
        } else {
            // For other sorting fields, use the requested sort first, then question_order as secondary
            orderArray.push([sortBy, sortOrder]);
            orderArray.push(['question_order', 'ASC']);
        }

        const { count, rows } = await Question.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: orderArray,
            attributes: {
                exclude: ['correct_answer'] // Don't send correct answer in list view
            }
        });

        res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (err) {
        console.error('Get questions error:', err);
        const error = new ErrorHandler('Failed to fetch questions', 500);
        return next(error);
    }
};

// Get single question by ID (with correct answer for admin)
exports.getQuestionById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const question = await Question.findByPk(id);
        if (!question) {
            return next(new ErrorHandler('Question not found', 404));
        }

        res.status(200).json({
            success: true,
            data: question
        });
    } catch (err) {
        console.error('Get question by ID error:', err);
        const error = new ErrorHandler('Failed to fetch question', 500);
        return next(error);
    }
};

// Create new question
exports.createQuestion = async (req, res, next) => {
    try {
        const {
            question_text,
            question_text_gujarati,
            option_a,
            option_a_gujarati,
            option_b,
            option_b_gujarati,
            option_c,
            option_c_gujarati,
            option_d,
            option_d_gujarati,
            correct_answer,
            explanation,
            explanation_gujarati,
            difficulty,
            subject,
            topic
        } = req.body;

        // Validate correct answer
        if (!['A', 'B', 'C', 'D'].includes(correct_answer)) {
            return next(new ErrorHandler('Correct answer must be A, B, C, or D', 400));
        }

        const question = await Question.create({
            question_text,
            question_text_gujarati,
            option_a,
            option_a_gujarati,
            option_b,
            option_b_gujarati,
            option_c,
            option_c_gujarati,
            option_d,
            option_d_gujarati,
            correct_answer,
            explanation,
            explanation_gujarati,
            difficulty,
            subject,
            topic,
            created_by: req.admin.id
        });

        res.status(201).json({
            success: true,
            message: 'Question created successfully',
            data: question
        });
    } catch (err) {
        console.error('Create question error:', err);
        const error = new ErrorHandler('Failed to create question', 500);
        return next(error);
    }
};

// Update question
exports.updateQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const question = await Question.findByPk(id);
        if (!question) {
            return next(new ErrorHandler('Question not found', 404));
        }

        // Validate correct answer if being updated
        if (updateData.correct_answer && !['A', 'B', 'C', 'D'].includes(updateData.correct_answer)) {
            return next(new ErrorHandler('Correct answer must be A, B, C, or D', 400));
        }

        await question.update(updateData);

        res.status(200).json({
            success: true,
            message: 'Question updated successfully',
            data: question
        });
    } catch (err) {
        console.error('Update question error:', err);
        const error = new ErrorHandler('Failed to update question', 500);
        return next(error);
    }
};

// Delete question
exports.deleteQuestion = async (req, res, next) => {
    try {
        const { id } = req.params;

        const question = await Question.findByPk(id);
        if (!question) {
            return next(new ErrorHandler('Question not found', 404));
        }

        await question.destroy();

        res.status(200).json({
            success: true,
            message: 'Question deleted successfully'
        });
    } catch (err) {
        console.error('Delete question error:', err);
        const error = new ErrorHandler('Failed to delete question', 500);
        return next(error);
    }
};

// Bulk create questions from CSV/JSON
exports.bulkCreateQuestions = async (req, res, next) => {
    try {
        const { questions } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return next(new ErrorHandler('Question array is required', 400));
        }

        // Validate each question
        const validQuestion = [];
        const errors = [];

        questions.forEach((q, index) => {
            if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_answer) {
                errors.push(`Question ${index + 1}: Missing required fields`);
                return;
            }

            if (!['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
                errors.push(`Question ${index + 1}: Invalid correct answer`);
                return;
            }

            validQuestion.push({
                ...q,
                created_by: req.admin.id
            });
        });

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors found',
                errors
            });
        }

        const createdQuestion = await Question.bulkCreate(validQuestion);

        res.status(201).json({
            success: true,
            message: `${createdQuestion.length} questions created successfully`,
            data: {
                created_count: createdQuestion.length,
                total_submitted: questions.length
            }
        });
    } catch (err) {
        console.error('Bulk create questions error:', err);
        const error = new ErrorHandler('Failed to create questions', 500);
        return next(error);
    }
};

// Get questions statistics
exports.getQuestionsStats = async (req, res, next) => {
    try {
        // Check if this is a template download request
        if (req.query.download === 'template') {
            // console.log('📥 Template download requested via stats endpoint');
            const format = req.query.format || 'excel';
            return await generateAndSendTemplate(req, res, next, format);
        }
        
        // Check if this is a file upload request
        if (req.query.action === 'import' && req.method === 'POST') {
            // console.log('📤 File upload requested via stats endpoint');
            return await handleFileUpload(req, res, next);
        }
        
        const totalQuestion = await Question.count();
        
        // Get difficulty-wise count
        const difficultyStats = await Question.findAll({
            attributes: [
                'difficulty',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            group: ['difficulty'],
            order: [['difficulty', 'ASC']]
        });

        // Get subject-wise count
        const subjectStats = await Question.findAll({
            attributes: [
                'subject',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            group: ['subject'],
            order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']],
            limit: 10
        });

        res.status(200).json({
            success: true,
            data: {
                total_questions: totalQuestion,
                difficulty_stats: difficultyStats,
                subject_stats: subjectStats
            }
        });
    } catch (err) {
        console.error('Get questions stats error:', err);
        const error = new ErrorHandler('Failed to fetch questions statistics', 500);
        return next(error);
    }
};

// Get unique subjects and topics for filters
exports.getQuestionFilters = async (req, res, next) => {
    try {
        const subjects = await Question.findAll({
            attributes: ['subject'],
            group: ['subject'],
            order: [['subject', 'ASC']]
        });

        const topics = await Question.findAll({
            attributes: ['topic', 'subject'],
            group: ['topic', 'subject'],
            order: [['subject', 'ASC'], ['topic', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: {
                subjects: subjects.map(s => s.subject),
                topics: topics.reduce((acc, t) => {
                    if (!acc[t.subject]) {
                        acc[t.subject] = [];
                    }
                    acc[t.subject].push(t.topic);
                    return acc;
                }, {})
            }
        });
    } catch (err) {
        console.error('Get question filters error:', err);
        const error = new ErrorHandler('Failed to fetch question filters', 500);
        return next(error);
    }
};

// Download Excel template for question import
exports.downloadExcelTemplate = async (req, res, next) => {
    try {
        // console.log('📥 Excel template download requested');
        
        // Create sample data for template
        const sampleData = [
            {
                'Question Text (English)': 'What is the capital of Gujarat?',
                'Question Text (Gujarati)': 'ગુજરાતની રાજધાની કઈ છે?',
                'Option A (English)': 'Ahmedabad',
                'Option A (Gujarati)': 'અમદાવાદ',
                'Option B (English)': 'Gandhinagar',
                'Option B (Gujarati)': 'ગાંધીનગર',
                'Option C (English)': 'Surat',
                'Option C (Gujarati)': 'સુરત',
                'Option D (English)': 'Rajkot',
                'Option D (Gujarati)': 'રાજકોટ',
                'Correct Answer': 'B',
                'Explanation (English)': 'Gandhinagar is the capital of Gujarat state.',
                'Explanation (Gujarati)': 'ગાંધીનગર ગુજરાત રાજ્યની રાજધાની છે.',
                'Marks': 1
            },
            {
                'Question Text (English)': 'Sample question 2 - Delete this row',
                'Question Text (Gujarati)': 'નમૂનો પ્રશ્ન 2 - આ પંક્તિ કાઢી નાખો',
                'Option A (English)': 'Option 1',
                'Option A (Gujarati)': 'વિકલ્પ 1',
                'Option B (English)': 'Option 2',
                'Option B (Gujarati)': 'વિકલ્પ 2',
                'Option C (English)': 'Option 3',
                'Option C (Gujarati)': 'વિકલ્પ 3',
                'Option D (English)': 'Option 4',
                'Option D (Gujarati)': 'વિકલ્પ 4',
                'Correct Answer': 'A',
                'Explanation (English)': 'Sample explanation',
                'Explanation (Gujarati)': 'નમૂનો સમજૂતી',
                'Marks': 1
            }
        ];

        // Generate Excel
        const XLSX = require('xlsx');
        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="questions_template.xlsx"');
        
        // console.log('✅ Excel template generated successfully');
        res.send(buffer);

    } catch (error) {
        console.error('Download Excel template error:', error);
        next(new ErrorHandler('Failed to generate Excel template', 500));
    }
};

// Download CSV template for question import
exports.downloadCsvTemplate = async (req, res, next) => {
    try {
        // console.log('📥 CSV template download requested');
        
        // Create sample data for template
        const sampleData = [
            {
                'Question Text (English)': 'What is the capital of Gujarat?',
                'Question Text (Gujarati)': 'ગુજરાતની રાજધાની કઈ છે?',
                'Option A (English)': 'Ahmedabad',
                'Option A (Gujarati)': 'અમદાવાદ',
                'Option B (English)': 'Gandhinagar',
                'Option B (Gujarati)': 'ગાંધીનગર',
                'Option C (English)': 'Surat',
                'Option C (Gujarati)': 'સુરત',
                'Option D (English)': 'Rajkot',
                'Option D (Gujarati)': 'રાજકોટ',
                'Correct Answer': 'B',
                'Explanation (English)': 'Gandhinagar is the capital of Gujarat state.',
                'Explanation (Gujarati)': 'ગાંધીનગર ગુજરાત રાજ્યની રાજધાની છે.',
                'Marks': 1
            },
            {
                'Question Text (English)': 'Sample question 2 - Delete this row',
                'Question Text (Gujarati)': 'નમૂનો પ્રશ્ન 2 - આ પંક્તિ કાઢી નાખો',
                'Option A (English)': 'Option 1',
                'Option A (Gujarati)': 'વિકલ્પ 1',
                'Option B (English)': 'Option 2',
                'Option B (Gujarati)': 'વિકલ્પ 2',
                'Option C (English)': 'Option 3',
                'Option C (Gujarati)': 'વિકલ્પ 3',
                'Option D (English)': 'Option 4',
                'Option D (Gujarati)': 'વિકલ્પ 4',
                'Correct Answer': 'A',
                'Explanation (English)': 'Sample explanation',
                'Explanation (Gujarati)': 'નમૂનો સમજૂતી',
                'Marks': 1
            }
        ];

        // Generate CSV
        const XLSX = require('xlsx');
        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="questions_template.csv"');
        
        // console.log('✅ CSV template generated successfully');
        res.send(csv);

    } catch (error) {
        console.error('Download CSV template error:', error);
        next(new ErrorHandler('Failed to generate CSV template', 500));
    }
};

// Helper function to parse import file
const parseImportFile = async (filepath, fileType) => {
    try {
        // console.log(`📖 Parsing ${fileType} file: ${filepath}`);
        
        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(filepath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        // console.log(`📄 Found ${jsonData.length} rows in file`);
        
        return jsonData;
    } catch (error) {
        console.error('❌ File parsing error:', error);
        throw new Error(`Failed to parse file: ${error.message}`);
    }
};

// Helper function to convert line breaks from Excel to HTML <br> tags
const convertLineBreaksToHTML = (text) => {
    if (!text || typeof text !== 'string') {
        return text;
    }
    // Replace \r\n (Windows) or \n (Unix) with <br> tags
    // This makes bulk imported questions consistent with manually entered questions (HTML editor)
    return text.replace(/\r?\n/g, '<br>');
};

// Helper function to validate import data
const validateImportData = async (data, categoryId) => {
    const validQuestions = [];
    const errors = [];

    // console.log(`🔍 Validating ${data.length} rows...`);

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // Excel row number (accounting for header)

        try {
            // Required fields mapping - Convert line breaks to HTML <br> tags
            // This ensures bulk imported questions display the same as manually entered questions
            const questionData = {
                question_text: convertLineBreaksToHTML(row['Question Text (English)']),
                question_text_gujarati: convertLineBreaksToHTML(row['Question Text (Gujarati)']) || null,
                option_a: convertLineBreaksToHTML(row['Option A (English)']),
                option_a_gujarati: convertLineBreaksToHTML(row['Option A (Gujarati)']) || null,
                option_b: convertLineBreaksToHTML(row['Option B (English)']),
                option_b_gujarati: convertLineBreaksToHTML(row['Option B (Gujarati)']) || null,
                option_c: convertLineBreaksToHTML(row['Option C (English)']),
                option_c_gujarati: convertLineBreaksToHTML(row['Option C (Gujarati)']) || null,
                option_d: convertLineBreaksToHTML(row['Option D (English)']),
                option_d_gujarati: convertLineBreaksToHTML(row['Option D (Gujarati)']) || null,
                correct_answer: row['Correct Answer'],
                explanation: convertLineBreaksToHTML(row['Explanation (English)']) || null,
                explanation_gujarati: convertLineBreaksToHTML(row['Explanation (Gujarati)']) || null,
                marks: parseInt(row['Marks']) || 1,
                category_id: parseInt(categoryId),
                is_active: true
            };
            
            // Smart validation: Check if we have English or Gujarati content (or both)
            const hasEnglishContent = questionData.question_text && questionData.question_text.toString().trim() !== '';
            const hasGujaratiContent = questionData.question_text_gujarati && questionData.question_text_gujarati.toString().trim() !== '';

            // At least one language is required
            if (!hasEnglishContent && !hasGujaratiContent) {
                errors.push(`Row ${rowNumber}: Question Text is required (in English or Gujarati or both)`);
                continue;
            }

            // Validate options based on the primary language
            let primaryLang = hasEnglishContent ? 'english' : 'gujarati';
            let optionSuffix = primaryLang === 'english' ? '' : '_gujarati';

            const option_a_key = `option_a${optionSuffix}`;
            const option_b_key = `option_b${optionSuffix}`;
            const option_c_key = `option_c${optionSuffix}`;
            const option_d_key = `option_d${optionSuffix}`;

            if (!questionData[option_a_key] || !questionData[option_b_key] || !questionData[option_c_key] || !questionData[option_d_key]) {
                const langLabel = primaryLang === 'english' ? 'English' : 'Gujarati';
                errors.push(`Row ${rowNumber}: All options (A, B, C, D) are required in ${langLabel}`);
                continue;
            }
            
            if (!questionData.correct_answer || !['A', 'B', 'C', 'D'].includes(questionData.correct_answer.toUpperCase())) {
                errors.push(`Row ${rowNumber}: Correct Answer must be A, B, C, or D`);
                continue;
            }
            
            // Normalize correct answer
            questionData.correct_answer = questionData.correct_answer.toUpperCase();
            
            validQuestions.push(questionData);
            
        } catch (error) {
            errors.push(`Row ${rowNumber}: ${error.message}`);
        }
    }
    
    // console.log(`✅ Validation complete: ${validQuestions.length} valid, ${errors.length} errors`);
    
    return { validQuestions, errors };
};

// Handle file upload for question import
const handleFileUpload = async (req, res, next) => {
    try {
        // console.log('📤 Starting file upload process...');

        // Check if file was uploaded using multer
        if (!req.file) {
            return next(new ErrorHandler('No file uploaded', 400));
        }

        const file = req.file;
        const categoryId = req.body.category_id;
        
        // console.log('📄 File details:', {
//             name: file.originalname,
//             mimetype: file.mimetype,
//             size: file.size,
//             filename: file.filename,
//             path: file.path,
//             categoryId
//         });
        
        // Validate category_id
        if (!categoryId) {
            return next(new ErrorHandler('Category ID is required', 400));
        }
        
        // Check if category exists (check both Category and ExamCategory tables)
        const { Category } = require('../../models');
        let category = await Category.findByPk(categoryId);
        
        // If not found in Category table, check ExamCategory table
        if (!category) {
            category = await ExamCategory.findByPk(categoryId);
        }
        
        if (!category) {
            return next(new ErrorHandler('Category not found', 404));
        }
        
        // Validate file type based on extension (more reliable than MIME type)
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        
        if (!allowedExtensions.includes(fileExtension)) {
            return next(new ErrorHandler('Only Excel (.xlsx, .xls) and CSV files are allowed', 400));
        }
        
        // console.log(`✅ File validation passed: ${file.originalname} (${fileExtension})`);
        
        // File is already saved by multer at file.path
        const tempFilePath = file.path;
        // console.log(`💾 File uploaded and saved at: ${tempFilePath}`);
        
        try {
            // Parse the file
            const rawData = await parseImportFile(tempFilePath, file.mimetype.includes('csv') ? 'csv' : 'excel');
            
            if (!rawData || rawData.length === 0) {
                return next(new ErrorHandler('File is empty or could not be parsed', 400));
            }
            
            // Validate the data
            const { validQuestions, errors } = await validateImportData(rawData, categoryId);
            
            // Create import record
            const importRecord = await QuestionImport.create({
                admin_id: req.admin.id,
                category_id: categoryId,
                filename: file.filename, // Generated filename
                original_filename: file.originalname, // Original filename from user
                file_type: fileExtension === '.csv' ? 'csv' : 'excel', // Map extensions to ENUM values
                file_name: file.originalname,
                file_size: file.size,
                total_rows: rawData.length,
                valid_rows: validQuestions.length,
                error_rows: errors.length,
                validation_errors: errors.length > 0 ? JSON.stringify(errors) : null,
                import_status: validQuestions.length > 0 ? 'validated' : 'failed',
                import_summary: JSON.stringify({
                    validated_questions: validQuestions,
                    preview: validQuestions.slice(0, 5),
                    validation_completed_at: new Date()
                })
            });
            
            // console.log('📊 Import validation results:', {
//                 totalRows: rawData.length,
//                 validRows: validQuestions.length,
//                 errorRows: errors.length,
//                 importId: importRecord.id
//             });
            
            // Return validation results
            res.json({
                success: true,
                message: 'File processed successfully',
                data: {
                    import_id: importRecord.id,
                    total_rows: rawData.length,
                    valid_rows: validQuestions.length,
                    error_rows: errors.length,
                    errors: errors,
                    preview: validQuestions.slice(0, 5), // Show first 5 valid questions as preview
                    can_import: validQuestions.length > 0
                }
            });
            
        } finally {
            // Clean up temp file
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                // console.log('🗑️ Temporary file cleaned up');
            }
        }
        
    } catch (error) {
        console.error('❌ File upload error:', error);
        next(new ErrorHandler(`File upload failed: ${error.message}`, 500));
    }
};

// Get import status for polling
exports.getImportStatus = async (req, res, next) => {
    try {
        const { importId } = req.params;
        // console.log(`📋 Getting import status for: ${importId}`);
        
        const importRecord = await QuestionImport.findByPk(importId);
        
        if (!importRecord) {
            return next(new ErrorHandler('Import record not found', 404));
        }
        
        // Return import status information
        res.json({
            success: true,
            data: {
                import_id: importRecord.id,
                status: importRecord.import_status,
                total_rows: importRecord.total_rows,
                successful_imports: importRecord.successful_imports,
                failed_imports: importRecord.failed_imports,
                validation_errors: importRecord.validation_errors ? JSON.parse(importRecord.validation_errors) : [],
                import_errors: importRecord.import_errors ? JSON.parse(importRecord.import_errors) : [],
                created_at: importRecord.created_at,
                updated_at: importRecord.updated_at
            }
        });
        
    } catch (error) {
        console.error('❌ Get import status error:', error);
        next(new ErrorHandler(`Failed to get import status: ${error.message}`, 500));
    }
};

// Get import preview data - re-parse file to show preview
exports.getImportPreview = async (req, res, next) => {
    try {
        const { importId } = req.params;
        // console.log(`👁️ Getting import preview for: ${importId}`);
        
        const importRecord = await QuestionImport.findByPk(importId);
        
        if (!importRecord) {
            return next(new ErrorHandler('Import record not found', 404));
        }
        
        if (importRecord.import_status !== 'validated') {
            return next(new ErrorHandler('Import is not validated yet. Status: ' + importRecord.import_status, 400));
        }
        
        // Get the stored validated questions from import_summary
        let previewData = null;
        if (importRecord.import_summary) {
            try {
                const summaryData = JSON.parse(importRecord.import_summary);
                previewData = summaryData.preview || summaryData.validated_questions?.slice(0, 5) || [];
            } catch (error) {
                console.error('Failed to parse import summary:', error);
            }
        }
        
        res.json({
            success: true,
            message: 'Import preview data retrieved',
            data: {
                import_id: importRecord.id,
                status: importRecord.import_status,
                total_rows: importRecord.total_rows,
                successful_imports: importRecord.successful_imports,
                failed_imports: importRecord.failed_imports,
                file_name: importRecord.original_filename,
                file_type: importRecord.file_type,
                validation_errors: importRecord.validation_errors ? JSON.parse(importRecord.validation_errors) : [],
                preview: previewData || []
            }
        });
        
    } catch (error) {
        console.error('❌ Get import preview error:', error);
        next(new ErrorHandler(`Failed to get import preview: ${error.message}`, 500));
    }
};

// Confirm and complete import - actually insert questions into database
exports.confirmImport = async (req, res, next) => {
    try {
        const { importId } = req.params;
        // console.log(`✅ Confirming import for: ${importId}`);
        
        const importRecord = await QuestionImport.findByPk(importId);
        
        if (!importRecord) {
            return next(new ErrorHandler('Import record not found', 404));
        }
        
        if (importRecord.import_status !== 'validated') {
            return next(new ErrorHandler('Import is not ready for confirmation. Status: ' + importRecord.import_status, 400));
        }
        
        // Update status to importing
        await importRecord.update({ import_status: 'importing' });
        
        // Get the validated questions from stored import_summary
        let validatedQuestions = [];
        if (importRecord.import_summary) {
            try {
                const summaryData = JSON.parse(importRecord.import_summary);
                validatedQuestions = summaryData.validated_questions || [];
            } catch (error) {
                console.error('Failed to parse import summary:', error);
                return next(new ErrorHandler('Failed to retrieve validated questions from import record', 500));
            }
        }
        
        if (!validatedQuestions || validatedQuestions.length === 0) {
            return next(new ErrorHandler('No validated questions found in import record', 400));
        }
        
        // console.log(`📥 Importing ${validatedQuestions.length} questions directly to category ${importRecord.category_id}...`);
        
        const { v4: uuidv4 } = require('uuid');
        let successCount = 0;
        let failureCount = 0;
        const importErrors = [];
        const importedQuestionIds = [];
        
        // Insert each question
        for (let i = 0; i < validatedQuestions.length; i++) {
            try {
                const questionData = {
                    ...validatedQuestions[i],
                    uuid: uuidv4(),
                    // Skip test_id for now - questions will be linked directly to category
                    created_at: new Date(),
                    updated_at: new Date()
                };
                
                const createdQuestion = await Question.create(questionData, {
                    // Add error handling for constraint issues
                    validate: true
                });
                importedQuestionIds.push(createdQuestion.id);
                successCount++;
                
                // console.log(`✅ Imported question ${i + 1}: ${questionData.question_text?.substring(0, 50)}...`);
                
            } catch (error) {
                failureCount++;
                const errorMsg = `Row ${i + 1}: ${error.message}`;
                importErrors.push(errorMsg);
                console.error(`❌ Failed to import question ${i + 1}:`, error.message);
            }
        }
        
        // Update import record with results
        const finalStatus = failureCount === 0 ? 'completed' : (successCount > 0 ? 'completed' : 'failed');
        
        await importRecord.update({
            import_status: finalStatus,
            successful_imports: successCount,
            failed_imports: failureCount,
            import_errors: importErrors.length > 0 ? JSON.stringify(importErrors) : null,
            import_summary: JSON.stringify({
                imported_question_ids: importedQuestionIds,
                success_count: successCount,
                failure_count: failureCount,
                completed_at: new Date()
            })
        });
        
        // console.log(`🎉 Import completed! Success: ${successCount}, Failures: ${failureCount}`);

        // If questions were successfully imported, update category node_type to question_holder
        // console.log(`🔍 DEBUG: Checking if need to update category node_type. successCount: ${successCount}, category_id: ${importRecord.category_id}`);
        if (successCount > 0) {
          const { Category } = require('../../models');
          const category = await Category.findByPk(importRecord.category_id);
          // console.log(`🔍 DEBUG: Found category:`, {
//             id: category?.id,
//             name: category?.name,
//             node_type: category?.node_type
//           });
          if (category && category.node_type === 'unset') {
            // console.log(`🔄 DEBUG: Updating category node_type from 'unset' to 'question_holder'`);
            await category.update({ node_type: 'question_holder' });
            // console.log(`✅ Updated category "${category.name}" node_type to question_holder after importing ${successCount} questions`);
          } else {
            // console.log(`ℹ️ DEBUG: Category node_type not updated. Current node_type: ${category?.node_type}`);
          }
        } else {
          // console.log(`ℹ️ DEBUG: No questions imported (successCount: ${successCount}), skipping category node_type update`);
        }
        
        res.json({
            success: true,
            message: `Import completed successfully. ${successCount} questions imported${failureCount > 0 ? `, ${failureCount} failed` : ''}.`,
            data: {
                import_id: importRecord.id,
                status: finalStatus,
                successful_imports: successCount,
                failed_imports: failureCount,
                import_errors: importErrors,
                imported_question_ids: importedQuestionIds
            }
        });
        
    } catch (error) {
        console.error('❌ Confirm import error:', error);
        next(new ErrorHandler(`Failed to confirm import: ${error.message}`, 500));
    }
};

// Export the upload middleware for use in routes
exports.upload = upload;