const ErrorHandler = require('../../utils/default/errorHandler');
const { Pdfs, User } = require('../../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const NotificationTriggers = require('../../services/NotificationTriggers');

// Get all PDFs with pagination and filters
exports.getPdfs = async (req, res, next) => {
    try {
        // console.log('📋 PDF list request received');
        
        // Check if table exists by doing a simple count query
        const testQuery = await Pdfs.count().catch(err => {
            console.error('❌ PDFs table error:', err.message);
            throw new Error(`PDFs table issue: ${err.message}`);
        });
        
        // console.log('✅ PDFs table accessible, count:', testQuery);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const category_id = req.query.category_id || '';
        const exam_type_id = req.query.exam_type_id || '';
        const access_level = req.query.access_level || '';
        const is_active = req.query.is_active;
        const is_featured = req.query.is_featured;
        const sortBy = req.query.sortBy || 'created_at';
        const sortOrder = req.query.sortOrder || 'DESC';

        const offset = (page - 1) * limit;

        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } }
            ];
        }
        if (category_id) {
            whereClause.category_id = category_id;
        }
        if (exam_type_id) {
            whereClause.exam_type_id = exam_type_id;
        }
        if (access_level) {
            whereClause.access_level = access_level;
        }
        if (is_active !== undefined) {
            whereClause.is_active = is_active === 'true';
        }
        if (is_featured !== undefined) {
            whereClause.is_featured = is_featured === 'true';
        }

        // console.log('🔍 Query filters:', whereClause);

        const { count, rows } = await Pdfs.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [[sortBy, sortOrder]],
            attributes: [
                'id',
                'title',
                'description',
                'category_id',
                'original_filename',
                'file_size',
                'mime_type',
                'access_level',
                'test_series_id',
                'exam_type_id',
                'tags',
                'download_count',
                'view_count',
                'is_active',
                'is_featured',
                'uploaded_by',
                'created_at',
                'updated_at',
                // Pricing fields - now available in DB
                'price',
                'currency',
                'is_free',
                'discount_percentage',
                'subscription_required',
                'preview_pages'
            ]
        });

        // console.log('📊 Query results:', { count, resultsLength: rows.length });

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
        console.error('❌ Get PDFs error:', err);
        const error = new ErrorHandler(`Failed to fetch PDFs: ${err.message}`, 500);
        return next(error);
    }
};

// Get single PDF by ID
exports.getPdfById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const pdf = await Pdfs.findByPk(id);
        if (!pdf) {
            return next(new ErrorHandler('PDF not found', 404));
        }

        res.status(200).json({
            success: true,
            data: pdf
        });
    } catch (err) {
        console.error('Get PDF by ID error:', err);
        const error = new ErrorHandler('Failed to fetch PDF', 500);
        return next(error);
    }
};

// Create new PDF record
exports.createPdf = async (req, res, next) => {
    try {
        const {
            title,
            description,
            category_id,
            exam_type_id,
            test_series_id,
            access_level = 'free',
            file_path,
            original_filename,
            file_size,
            tags,
            is_active = true,
            is_featured = false
        } = req.body;

        // Check if PDF with same title exists
        const existingPdf = await Pdfs.findOne({ where: { title } });
        if (existingPdf) {
            return next(new ErrorHandler('PDF with this title already exists', 400));
        }

        const pdf = await Pdfs.create({
            title,
            description,
            category_id,
            exam_type_id,
            test_series_id,
            file_path,
            original_filename,
            file_size,
            access_level,
            tags,
            is_active,
            is_featured,
            download_count: 0,
            view_count: 0,
            uploaded_by: req.admin.id
        });

        // Load the PDF for response (without associations for now)
        const pdfWithAssociations = await Pdfs.findByPk(pdf.id);

        // Send notification to users about new PDF
        try {
            await NotificationTriggers.onNewPdfCreated({
                uuid: pdf.id,
                title: pdf.title,
                description: pdf.description,
                category: pdfWithAssociations.category?.name || 'General',
                subject: pdfWithAssociations.examType?.name || 'General',
                is_free: access_level === 'free'
            });
            // console.log('✅ Notification sent for new PDF:', pdf.title);
        } catch (notificationError) {
            console.error('⚠️  Failed to send notification for new PDF:', notificationError);
            // Don't fail the PDF creation if notification fails
        }

        res.status(201).json({
            success: true,
            message: 'PDF created successfully',
            data: pdfWithAssociations
        });
    } catch (err) {
        console.error('Create PDF error:', err);
        const error = new ErrorHandler('Failed to create PDF record', 500);
        return next(error);
    }
};

// Update PDF record
exports.updatePdf = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const pdf = await Pdfs.findByPk(id);
        if (!pdf) {
            return next(new ErrorHandler('PDF not found', 404));
        }

        // Check if title is being changed and already exists
        if (updateData.title && updateData.title !== pdf.title) {
            const existingPdf = await Pdfs.findOne({ 
                where: { 
                    title: updateData.title,
                    id: { [Op.ne]: id }
                } 
            });
            if (existingPdf) {
                return next(new ErrorHandler('PDF with this title already exists', 400));
            }
        }

        await pdf.update(updateData);

        res.status(200).json({
            success: true,
            message: 'PDF updated successfully',
            data: pdf
        });
    } catch (err) {
        console.error('Update PDF error:', err);
        const error = new ErrorHandler('Failed to update PDF', 500);
        return next(error);
    }
};

// Delete PDF
exports.deletePdf = async (req, res, next) => {
    try {
        const { id } = req.params;

        const pdf = await Pdfs.findByPk(id);
        if (!pdf) {
            return next(new ErrorHandler('PDF not found', 404));
        }

        // Optionally delete the actual file from storage
        // if (pdf.file_url && fs.existsSync(pdf.file_url)) {
        //     fs.unlinkSync(pdf.file_url);
        // }

        await pdf.destroy();

        res.status(200).json({
            success: true,
            message: 'PDF deleted successfully'
        });
    } catch (err) {
        console.error('Delete PDF error:', err);
        const error = new ErrorHandler('Failed to delete PDF', 500);
        return next(error);
    }
};

// Get PDF download URL (with access control)
exports.getPdfDownloadUrl = async (req, res, next) => {
    try {
        const { id } = req.params;
        // console.log('📥 Download request for PDF ID:', id);

        const pdf = await Pdfs.findByPk(id);
        if (!pdf) {
            // console.log('❌ PDF not found with ID:', id);
            return next(new ErrorHandler('PDF not found', 404));
        }

        // console.log('✅ PDF found:', { title: pdf.title, file_path: pdf.file_path });

        // Increment download count
        await pdf.increment('download_count');

        // Check if file exists on disk
        const filePath = path.resolve(pdf.file_path);
        // console.log('🔍 Checking file path:', filePath);
        
        if (!fs.existsSync(filePath)) {
            // console.log('❌ File not found on disk:', filePath);
            return next(new ErrorHandler('File not found on server', 404));
        }

        // Set appropriate headers for file download
        const filename = pdf.original_filename || `${pdf.title}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdf.file_size);

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        // console.log('✅ File streaming started for:', filename);
        
    } catch (err) {
        console.error('❌ Get PDF download error:', err);
        const error = new ErrorHandler('Failed to download PDF', 500);
        return next(error);
    }
};

// Upload PDF file
exports.uploadPdf = async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new ErrorHandler('Please upload a PDF file', 400));
        }

        const file = req.file;
        
        // Validate file type
        if (file.mimetype !== 'application/pdf') {
            return next(new ErrorHandler('Only PDF files are allowed', 400));
        }

        // File info for response
        const fileInfo = {
            filename: file.filename,
            originalname: file.originalname,
            size: file.size,
            path: file.path,
            mimetype: file.mimetype
        };

        res.status(200).json({
            success: true,
            message: 'PDF uploaded successfully',
            data: fileInfo
        });
    } catch (err) {
        console.error('Upload PDF error:', err);
        const error = new ErrorHandler('Failed to upload PDF', 500);
        return next(error);
    }
};

// Get PDF as base64 (secure, no downloads)
exports.getPdfBase64 = async (req, res, next) => {
    try {
        const { id } = req.params;
        // console.log('🔒 Secure PDF request for ID:', id);

        const pdf = await Pdfs.findByPk(id);
        if (!pdf) {
            return next(new ErrorHandler('PDF not found', 404));
        }

        // Increment view count
        await pdf.increment('view_count');

        // Check if file exists
        const filePath = path.resolve(pdf.file_path);
        if (!fs.existsSync(filePath)) {
            return next(new ErrorHandler('File not found on server', 404));
        }

        // Read file and convert to base64
        const fileBuffer = fs.readFileSync(filePath);
        const base64Data = fileBuffer.toString('base64');

        // Send as JSON (not downloadable)
        res.json({
            success: true,
            data: {
                id: pdf.id,
                title: pdf.title,
                content: `data:application/pdf;base64,${base64Data}`,
                pages: 1 // You can calculate actual pages if needed
            }
        });

    } catch (err) {
        console.error('Get PDF base64 error:', err);
        return next(new ErrorHandler('Failed to load PDF', 500));
    }
};

// View PDF file (for in-app viewing)
exports.viewPdf = async (req, res, next) => {
    try {
        const { id } = req.params;
        // console.log('👁️ View request for PDF ID:', id);

        const pdf = await Pdfs.findByPk(id);
        if (!pdf) {
            // console.log('❌ PDF not found with ID:', id);
            return next(new ErrorHandler('PDF not found', 404));
        }

        // console.log('✅ PDF found:', { title: pdf.title, file_path: pdf.file_path });
        // console.log('📄 Full PDF Details:', {
//             id: pdf.id,
//             title: pdf.title,
//             original_filename: pdf.original_filename,
//             file_size: pdf.file_size,
//             file_path: pdf.file_path,
//             access_level: pdf.access_level
//         });

        // Increment view count
        await pdf.increment('view_count');

        // Check if file exists on disk
        const filePath = path.resolve(pdf.file_path);
        // console.log('🔍 Checking file path:', filePath);
        
        if (!fs.existsSync(filePath)) {
            // console.log('❌ File not found on disk:', filePath);
            return next(new ErrorHandler('File not found on server', 404));
        }

        // Set appropriate headers for inline viewing ONLY (no downloads)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline'); // Remove filename to prevent download
        res.setHeader('Content-Length', pdf.file_size);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); // Prevent caching
        
        // CORS headers for in-app viewing
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Security headers to prevent downloads and external access
        res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Allow embedding only from same origin
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Download-Options', 'noopen'); // IE8+ prevention
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
        
        // Check referrer to ensure request is from our app
        const referrer = req.get('Referer') || req.get('Origin') || '';
        // console.log('🔒 Request referrer:', referrer);
        
        // You can add additional security checks here
        // For now, we'll allow all requests but log them

        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        fileStream.on('error', (error) => {
            console.error('❌ Error streaming PDF:', error);
            if (!res.headersSent) {
                return next(new ErrorHandler('Error streaming PDF file', 500));
            }
        });

    } catch (err) {
        console.error('View PDF error:', err);
        const error = new ErrorHandler('Failed to view PDF', 500);
        return next(error);
    }
};

// Get PDF statistics
exports.getPdfStats = async (req, res, next) => {
    try {
        const totalPdfs = await Pdfs.count({ where: { is_active: true } });
        const freePdfs = await Pdfs.count({ where: { access_level: 'free', is_active: true } });
        const premiumPdfs = await Pdfs.count({ where: { access_level: 'premium', is_active: true } });
        const restrictedPdfs = await Pdfs.count({ where: { access_level: 'restricted', is_active: true } });
        const featuredPdfs = await Pdfs.count({ where: { is_featured: true, is_active: true } });
        
        // Get total downloads and views
        const downloadStats = await Pdfs.findAll({
            attributes: [
                [require('sequelize').fn('SUM', require('sequelize').col('download_count')), 'total_downloads'],
                [require('sequelize').fn('SUM', require('sequelize').col('view_count')), 'total_views']
            ]
        });

        // Get category-wise count (simplified for now)
        const categoryStats = [];

        // Get most downloaded PDFs
        const topDownloads = await Pdfs.findAll({
            attributes: ['id', 'title', 'download_count', 'view_count', 'category_id'],
            where: { is_active: true },
            order: [['download_count', 'DESC']],
            limit: 10
        });

        res.status(200).json({
            success: true,
            data: {
                total_pdfs: totalPdfs,
                free_pdfs: freePdfs,
                premium_pdfs: premiumPdfs,
                restricted_pdfs: restrictedPdfs,
                featured_pdfs: featuredPdfs,
                total_downloads: downloadStats[0]?.dataValues?.total_downloads || 0,
                total_views: downloadStats[0]?.dataValues?.total_views || 0,
                category_stats: categoryStats,
                top_downloads: topDownloads
            }
        });
    } catch (err) {
        console.error('Get PDF stats error:', err);
        const error = new ErrorHandler('Failed to fetch PDF statistics', 500);
        return next(error);
    }
};

// Get PDF categories
exports.getPdfCategories = async (req, res, next) => {
    try {
        const { PdfCategory } = require('../../models');
        
        const categories = await PdfCategory.findAll({
            attributes: ['id', 'name', 'slug', 'description', 'icon', 'color', 'sort_order'],
            where: { is_active: true },
            order: [['sort_order', 'ASC'], ['name', 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: categories
        });
    } catch (err) {
        console.error('Get PDF categories error:', err);
        const error = new ErrorHandler('Failed to fetch PDF categories', 500);
        return next(error);
    }
};

// Get PDF categories and subjects for filters
exports.getPdfFilters = async (req, res, next) => {
    try {
        // Get PDF categories
        const { PdfCategory, ExamType } = require('../../models');
        
        const categories = await PdfCategory.findAll({
            attributes: ['id', 'name', 'description'],
            where: { is_active: true },
            order: [['name', 'ASC']]
        });

        const examTypes = await ExamType.findAll({
            attributes: ['id', 'name', 'description'],
            where: { is_active: true },
            order: [['name', 'ASC']]
        });

        // Get access levels
        const accessLevels = [
            { value: 'free', label: 'Free' },
            { value: 'premium', label: 'Premium' },
            { value: 'restricted', label: 'Restricted' }
        ];

        res.status(200).json({
            success: true,
            data: {
                categories: categories,
                examTypes: examTypes,
                accessLevels: accessLevels
            }
        });
    } catch (err) {
        console.error('Get PDF filters error:', err);
        const error = new ErrorHandler('Failed to fetch PDF filters', 500);
        return next(error);
    }
};