const { QuestionImport, Question, Category, Admin, TestSeries } = require('../../models');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ErrorHandler = require('../../utils/default/errorHandler');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/question_imports');
    
    // Create directory if it doesn't exist
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

const fileFilter = function (req, file, cb) {
  // Check file type
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv' // .csv
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ErrorHandler('Only Excel (.xlsx, .xls) and CSV files are allowed', 400), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Template structure for questions
const TEMPLATE_HEADERS = {
  'Question Text (English)': 'question_text',
  'Question Text (Gujarati)': 'question_text_gujarati',
  'Option A (English)': 'option_a',
  'Option B (English)': 'option_b', 
  'Option C (English)': 'option_c',
  'Option D (English)': 'option_d',
  'Option A (Gujarati)': 'option_a_gujarati',
  'Option B (Gujarati)': 'option_b_gujarati',
  'Option C (Gujarati)': 'option_c_gujarati',
  'Option D (Gujarati)': 'option_d_gujarati',
  'Correct Answer': 'correct_answer',
  'Explanation (English)': 'explanation',
  'Explanation (Gujarati)': 'explanation_gujarati',
  'Marks': 'marks'
};

class QuestionImportController {
  // Download template file
  async downloadTemplate(req, res, next) {
    try {
      const { format } = req.params; // 'excel' or 'csv'
      
      if (!['excel', 'csv'].includes(format)) {
        return next(new ErrorHandler('Invalid format. Use excel or csv', 400));
      }

      // Create sample data
      const sampleData = [
        {
          'Question Text (English)': 'What is the capital of Gujarat?',
          'Question Text (Gujarati)': 'ગુજરાતની રાજધાની શું છે?',
          'Option A (English)': 'Ahmedabad',
          'Option B (English)': 'Gandhinagar',
          'Option C (English)': 'Surat', 
          'Option D (English)': 'Rajkot',
          'Option A (Gujarati)': 'અમદાવાદ',
          'Option B (Gujarati)': 'ગાંધીનગર',
          'Option C (Gujarati)': 'સુરત',
          'Option D (Gujarati)': 'રાજકોટ',
          'Correct Answer': 'B',
          'Explanation (English)': 'Gandhinagar is the capital city of Gujarat state in India.',
          'Explanation (Gujarati)': 'ગાંધીનગર એ ભારતના ગુજરાત રાજ્યની રાજધાની છે.',
          'Marks': 1
        },
        {
          'Question Text (English)': 'Which river flows through Ahmedabad?',
          'Question Text (Gujarati)': 'કઈ નદી અમદાવાદમાંથી વહે છે?',
          'Option A (English)': 'Narmada',
          'Option B (English)': 'Sabarmati',
          'Option C (English)': 'Tapi',
          'Option D (English)': 'Mahi',
          'Option A (Gujarati)': 'નર્મદા',
          'Option B (Gujarati)': 'સાબરમતી',
          'Option C (Gujarati)': 'તાપી',
          'Option D (Gujarati)': 'માહી',
          'Correct Answer': 'B',
          'Explanation (English)': 'The Sabarmati River flows through Ahmedabad city.',
          'Explanation (Gujarati)': 'સાબરમતી નદી અમદાવાદ શહેરમાંથી વહે છે.',
          'Marks': 1
        }
      ];

      if (format === 'excel') {
        // Create Excel file
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sampleData);
        
        // Set column widths for better readability
        const colWidths = [
          { wch: 50 }, // Question Text (English)
          { wch: 50 }, // Question Text (Gujarati)
          { wch: 20 }, // Option A (English)
          { wch: 20 }, // Option B (English)
          { wch: 20 }, // Option C (English)
          { wch: 20 }, // Option D (English)
          { wch: 20 }, // Option A (Gujarati)
          { wch: 20 }, // Option B (Gujarati)
          { wch: 20 }, // Option C (Gujarati)
          { wch: 20 }, // Option D (Gujarati)
          { wch: 15 }, // Correct Answer
          { wch: 40 }, // Explanation (English)
          { wch: 40 }, // Explanation (Gujarati)
          { wch: 10 }  // Marks
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Questions');
        
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=question_import_template.xlsx');
        res.send(buffer);
        
      } else if (format === 'csv') {
        // Create CSV file
        const csvHeaders = Object.keys(sampleData[0]);
        const csvRows = sampleData.map(row => csvHeaders.map(header => `"${row[header]}"`).join(','));
        const csvContent = [csvHeaders.map(h => `"${h}"`).join(','), ...csvRows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=question_import_template.csv');
        res.send(csvContent);
      }
      
    } catch (error) {
      console.error('Template download error:', error);
      next(new ErrorHandler('Failed to generate template', 500));
    }
  }

  // Upload and validate import file
  async uploadImportFile(req, res, next) {
    try {
      // Handle file upload
      upload.single('file')(req, res, async (uploadErr) => {
        if (uploadErr) {
          return next(uploadErr);
        }

        if (!req.file) {
          return next(new ErrorHandler('No file uploaded', 400));
        }

        const { category_id, test_series_id } = req.body;
        const adminId = req.admin?.id;

        if (!category_id) {
          // Clean up uploaded file
          fs.unlinkSync(req.file.path);
          return next(new ErrorHandler('Category ID is required', 400));
        }

        // Verify category exists and can hold questions
        const category = await Category.findByPk(category_id);
        if (!category) {
          fs.unlinkSync(req.file.path);
          return next(new ErrorHandler('Category not found', 404));
        }

        // Check if category can hold questions (should be question_holder type)
        if (category.node_type !== 'question_holder' && category.node_type !== 'unset') {
          fs.unlinkSync(req.file.path);
          return next(new ErrorHandler('Selected category cannot contain questions directly', 400));
        }

        // Determine file type
        const fileType = req.file.mimetype.includes('csv') ? 'csv' : 'excel';

        // Create import record
        const importRecord = await QuestionImport.create({
          admin_id: adminId,
          category_id: category_id,
          test_series_id: test_series_id || null,
          filename: req.file.filename,
          original_filename: req.file.originalname,
          file_size: req.file.size,
          file_type: fileType,
          import_status: 'uploaded'
        });

        // Start validation in background
        this.validateImportFile(importRecord.id, req.file.path, fileType);

        res.json({
          success: true,
          data: {
            import_id: importRecord.id,
            status: 'uploaded',
            message: 'File uploaded successfully. Validation in progress...'
          }
        });
      });

    } catch (error) {
      console.error('Upload error:', error);
      next(new ErrorHandler('File upload failed', 500));
    }
  }

  // Validate uploaded file (runs in background)
  async validateImportFile(importId, filePath, fileType) {
    let importRecord;
    
    try {
      importRecord = await QuestionImport.findByPk(importId);
      if (!importRecord) return;

      // Update status to validating
      await importRecord.update({ import_status: 'validating' });

      const validationResult = await this.parseAndValidateFile(filePath, fileType);
      
      // Update import record with validation results
      await importRecord.update({
        import_status: validationResult.isValid ? 'validated' : 'failed',
        total_rows: validationResult.totalRows,
        validation_errors: validationResult.errors
      });

    } catch (error) {
      console.error('Validation error:', error);
      if (importRecord) {
        await importRecord.update({
          import_status: 'failed',
          validation_errors: [{ error: 'Validation process failed', details: error.message }]
        });
      }
    }
  }

  // Parse and validate file contents
  async parseAndValidateFile(filePath, fileType) {
    const errors = [];
    const questions = [];
    let totalRows = 0;

    try {
      if (fileType === 'excel') {
        // Parse Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        totalRows = jsonData.length;
        
        // Validate each row
        jsonData.forEach((row, index) => {
          const rowNumber = index + 2; // +2 because index starts at 0 and we skip header
          const questionOrder = index + 1; // +1 because we want order to start from 1
          const validationResult = this.validateQuestionRow(row, rowNumber, questionOrder);

          if (validationResult.errors.length > 0) {
            errors.push(...validationResult.errors);
          } else {
            questions.push(validationResult.question);
          }
        });
        
      } else if (fileType === 'csv') {
        // Parse CSV file
        return new Promise((resolve, reject) => {
          const csvData = [];
          let rowCount = 0;
          
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
              csvData.push(row);
              rowCount++;
            })
            .on('end', () => {
              totalRows = rowCount;
              
              // Validate each row
              csvData.forEach((row, index) => {
                const rowNumber = index + 2;
                const questionOrder = index + 1; // +1 because we want order to start from 1
                const validationResult = this.validateQuestionRow(row, rowNumber, questionOrder);

                if (validationResult.errors.length > 0) {
                  errors.push(...validationResult.errors);
                } else {
                  questions.push(validationResult.question);
                }
              });
              
              resolve({
                isValid: errors.length === 0,
                totalRows,
                errors,
                validQuestions: questions
              });
            })
            .on('error', (error) => {
              reject(error);
            });
        });
      }

      return {
        isValid: errors.length === 0,
        totalRows,
        errors,
        validQuestions: questions
      };

    } catch (error) {
      console.error('File parsing error:', error);
      throw new Error('Failed to parse file: ' + error.message);
    }
  }

  // Validate individual question row
  validateQuestionRow(row, rowNumber, questionOrder = null) {
    const errors = [];
    const question = {};

    // Check if we have English or Gujarati content (or both)
    const hasEnglishContent = row['Question Text (English)'] && row['Question Text (English)'].toString().trim() !== '';
    const hasGujaratiContent = row['Question Text (Gujarati)'] && row['Question Text (Gujarati)'].toString().trim() !== '';

    // Must have at least one language
    if (!hasEnglishContent && !hasGujaratiContent) {
      errors.push({
        row: rowNumber,
        field: 'Question Text',
        error: 'Question text is required in at least one language (English or Gujarati)'
      });
      return { errors, question };
    }

    // Validate English fields if English content exists
    if (hasEnglishContent) {
      const englishRequiredFields = [
        'Question Text (English)',
        'Option A (English)',
        'Option B (English)',
        'Option C (English)',
        'Option D (English)'
      ];

      englishRequiredFields.forEach(field => {
        if (!row[field] || row[field].toString().trim() === '') {
          errors.push({
            row: rowNumber,
            field: field,
            error: `${field} is required when providing English content`
          });
        }
      });
    }

    // Validate Gujarati fields if Gujarati content exists
    if (hasGujaratiContent) {
      const gujaratiRequiredFields = [
        'Question Text (Gujarati)',
        'Option A (Gujarati)',
        'Option B (Gujarati)',
        'Option C (Gujarati)',
        'Option D (Gujarati)'
      ];

      gujaratiRequiredFields.forEach(field => {
        if (!row[field] || row[field].toString().trim() === '') {
          errors.push({
            row: rowNumber,
            field: field,
            error: `${field} is required when providing Gujarati content`
          });
        }
      });
    }

    // Correct Answer is always required
    if (!row['Correct Answer'] || row['Correct Answer'].toString().trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'Correct Answer',
        error: 'Correct Answer is required'
      });
    }

    // Validate correct answer format
    if (row['Correct Answer']) {
      const correctAnswer = row['Correct Answer'].toString().toUpperCase().trim();
      if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
        errors.push({
          row: rowNumber,
          field: 'Correct Answer',
          error: 'Correct Answer must be A, B, C, or D'
        });
      }
    }

    // Validate marks (must be positive integer)
    const marks = parseInt(row['Marks'] || 1);
    if (isNaN(marks) || marks < 1 || marks > 10) {
      errors.push({
        row: rowNumber,
        field: 'Marks',
        error: 'Marks must be a number between 1 and 10'
      });
    }

    // If no errors, create question object
    if (errors.length === 0) {
      // Handle English content (only if English content exists)
      question.question_text = hasEnglishContent ? row['Question Text (English)'].toString().trim() : null;
      question.option_a = hasEnglishContent ? row['Option A (English)'].toString().trim() : null;
      question.option_b = hasEnglishContent ? row['Option B (English)'].toString().trim() : null;
      question.option_c = hasEnglishContent ? row['Option C (English)'].toString().trim() : null;
      question.option_d = hasEnglishContent ? row['Option D (English)'].toString().trim() : null;
      question.explanation = (hasEnglishContent && row['Explanation (English)']) ? row['Explanation (English)'].toString().trim() : null;

      // Handle Gujarati content (only if Gujarati content exists)
      question.question_text_gujarati = hasGujaratiContent ? row['Question Text (Gujarati)'].toString().trim() : null;
      question.option_a_gujarati = hasGujaratiContent ? row['Option A (Gujarati)'].toString().trim() : null;
      question.option_b_gujarati = hasGujaratiContent ? row['Option B (Gujarati)'].toString().trim() : null;
      question.option_c_gujarati = hasGujaratiContent ? row['Option C (Gujarati)'].toString().trim() : null;
      question.option_d_gujarati = hasGujaratiContent ? row['Option D (Gujarati)'].toString().trim() : null;
      question.explanation_gujarati = (hasGujaratiContent && row['Explanation (Gujarati)']) ? row['Explanation (Gujarati)'].toString().trim() : null;

      // Common fields
      question.correct_answer = row['Correct Answer'].toString().toUpperCase().trim();
      question.marks = marks;
      question.is_active = true;

      // Preserve order from Excel
      if (questionOrder !== null) {
        question.question_order = questionOrder;
      }
    }

    return { errors, question };
  }

  // Get import status
  async getImportStatus(req, res, next) {
    try {
      const { import_id } = req.params;
      
      const importRecord = await QuestionImport.findByPk(import_id, {
        include: [
          { model: Category, as: 'category', attributes: ['id', 'name'] },
          { model: Admin, as: 'admin', attributes: ['id', 'name', 'email'] }
        ]
      });

      if (!importRecord) {
        return next(new ErrorHandler('Import record not found', 404));
      }

      res.json({
        success: true,
        data: importRecord
      });

    } catch (error) {
      console.error('Get import status error:', error);
      next(new ErrorHandler('Failed to get import status', 500));
    }
  }

  // Preview import data before final import
  async previewImport(req, res, next) {
    try {
      const { import_id } = req.params;
      
      const importRecord = await QuestionImport.findByPk(import_id);
      if (!importRecord) {
        return next(new ErrorHandler('Import record not found', 404));
      }

      if (importRecord.import_status !== 'validated') {
        return next(new ErrorHandler('Import must be validated before preview', 400));
      }

      // Re-parse file to get preview data
      const filePath = path.join(__dirname, '../../uploads/question_imports', importRecord.filename);
      const parseResult = await this.parseAndValidateFile(filePath, importRecord.file_type);

      // Return first 5 questions for preview
      const previewQuestions = parseResult.validQuestions.slice(0, 5);

      res.json({
        success: true,
        data: {
          total_valid_questions: parseResult.validQuestions.length,
          total_errors: parseResult.errors.length,
          preview_questions: previewQuestions,
          validation_errors: parseResult.errors.slice(0, 10) // Show first 10 errors
        }
      });

    } catch (error) {
      console.error('Preview import error:', error);
      next(new ErrorHandler('Failed to preview import', 500));
    }
  }

  // Confirm and execute import
  async confirmImport(req, res, next) {
    try {
      const { import_id } = req.params;
      
      const importRecord = await QuestionImport.findByPk(import_id);
      if (!importRecord) {
        return next(new ErrorHandler('Import record not found', 404));
      }

      if (importRecord.import_status !== 'validated') {
        return next(new ErrorHandler('Import must be validated before confirmation', 400));
      }

      // Update status to importing
      await importRecord.update({ import_status: 'importing' });

      // Execute import in background
      this.executeImport(import_id);

      res.json({
        success: true,
        data: {
          message: 'Import started. You will receive updates on the progress.',
          import_id: import_id
        }
      });

    } catch (error) {
      console.error('Confirm import error:', error);
      next(new ErrorHandler('Failed to start import', 500));
    }
  }

  // Execute actual import (runs in background)
  async executeImport(importId) {
    let importRecord;
    
    try {
      importRecord = await QuestionImport.findByPk(importId);
      if (!importRecord) return;

      const filePath = path.join(__dirname, '../../uploads/question_imports', importRecord.filename);
      const parseResult = await this.parseAndValidateFile(filePath, importRecord.file_type);

      let successCount = 0;
      let failCount = 0;
      const importErrors = [];
      const createdQuestions = [];

      // Offset new question_order values past whatever already exists in this
      // category so a repeat/second import doesn't collide with prior order values
      // (question_order is scoped per category_id) and reshuffle existing questions.
      const existingMaxOrder = await Question.max('question_order', {
        where: { category_id: importRecord.category_id }
      });
      const orderOffset = existingMaxOrder || 0;

      // Import each valid question
      for (const questionData of parseResult.validQuestions) {
        try {
          const question = await Question.create({
            ...questionData,
            question_order: questionData.question_order != null
              ? questionData.question_order + orderOffset
              : questionData.question_order,
            category_id: importRecord.category_id
          });
          
          createdQuestions.push(question.id);
          successCount++;
          
        } catch (error) {
          failCount++;
          importErrors.push({
            question: questionData.question_text.substring(0, 50) + '...',
            error: error.message
          });
        }
      }

      // Update import record with results
      await importRecord.update({
        import_status: 'completed',
        successful_imports: successCount,
        failed_imports: failCount,
        import_errors: importErrors,
        import_summary: {
          created_question_ids: createdQuestions,
          total_processed: parseResult.validQuestions.length,
          success_rate: ((successCount / parseResult.validQuestions.length) * 100).toFixed(2) + '%'
        }
      });

      // If questions were successfully imported, update category node_type to question_holder
      // console.log(`🔍 DEBUG: Checking if need to update category node_type. successCount: ${successCount}, category_id: ${importRecord.category_id}`);
      if (successCount > 0) {
        const category = await Category.findByPk(importRecord.category_id);
        // console.log(`🔍 DEBUG: Found category:`, {
//           id: category?.id,
//           name: category?.name,
//           node_type: category?.node_type
//         });
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

      // Clean up uploaded file
      fs.unlinkSync(filePath);

    } catch (error) {
      console.error('Execute import error:', error);
      if (importRecord) {
        await importRecord.update({
          import_status: 'failed',
          import_errors: [{ error: 'Import execution failed', details: error.message }]
        });
      }
    }
  }

  // Get import history
  async getImportHistory(req, res, next) {
    try {
      const { page = 1, limit = 10, category_id } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = {};
      if (category_id) {
        whereClause.category_id = category_id;
      }

      const { count, rows: imports } = await QuestionImport.findAndCountAll({
        where: whereClause,
        include: [
          { model: Category, as: 'category', attributes: ['id', 'name'] },
          { model: Admin, as: 'admin', attributes: ['id', 'name', 'email'] }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      res.json({
        success: true,
        data: imports,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Get import history error:', error);
      next(new ErrorHandler('Failed to get import history', 500));
    }
  }
}

module.exports = new QuestionImportController();