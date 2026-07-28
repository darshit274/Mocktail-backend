const ErrorHandler = require('../../utils/default/errorHandler');
const { Pdfs, PdfCategory, Test_Series, ExamType, Admin } = require('../../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const {
  handlePDFUpload,
  deletePDFFile,
  getFileInfo,
  formatFileSize,
  validatePDFFile
} = require('../../utils/pdfUpload');
const { PDF_UPLOAD_MAX_SIZE_BYTES, PDF_UPLOAD_MAX_SIZE_MB } = require('../../utils/uploadConfig');

// Get all PDF categories
exports.getPdfCategories = async (req, res, next) => {
  try {
    const categories = await PdfCategory.findAll({
      where: { is_active: true },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
      include: [{
        model: Pdfs,
        as: 'pdfs',
        attributes: ['id'],
        required: false
      }]
    });

    // Add PDF count to each category
    const categoriesWithCount = categories.map(category => {
      const categoryData = category.toJSON();
      categoryData.pdf_count = categoryData.pdfs?.length || 0;
      delete categoryData.pdfs;
      return categoryData;
    });

    res.status(200).json({
      success: true,
      data: categoriesWithCount
    });
  } catch (err) {
    console.error('Get PDF categories error:', err);
    const error = new ErrorHandler('Failed to fetch PDF categories', 500);
    return next(error);
  }
};

// Create PDF category
exports.createPdfCategory = async (req, res, next) => {
  try {
    const { name, description, icon, color, sort_order } = req.body;

    if (!name) {
      return next(new ErrorHandler('Category name is required', 400));
    }

    // Generate slug from name
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');

    // Check if slug already exists
    const existingCategory = await PdfCategory.findOne({ where: { slug } });
    if (existingCategory) {
      return next(new ErrorHandler('Category with this name already exists', 400));
    }

    const category = await PdfCategory.create({
      name,
      slug,
      description,
      icon: icon || 'Folder',
      color: color || '#3B82F6',
      sort_order: sort_order || 0
    });

    res.status(201).json({
      success: true,
      message: 'PDF category created successfully',
      data: category
    });
  } catch (err) {
    console.error('Create PDF category error:', err);
    const error = new ErrorHandler('Failed to create PDF category', 500);
    return next(error);
  }
};

// Upload PDF
exports.uploadPdf = async (req, res, next) => {
  try {
    // console.log('🔍 DEBUG: PDF Upload Request Details:');
    // console.log('📋 req.body:', req.body);
    // console.log('📁 req.files:', req.files);
    // console.log('📄 req.file:', req.file);
    // console.log('🔑 req.admin:', req.admin?.id);
    // console.log('📝 Headers:', req.headers);

    const {
      title,
      description,
      course_id,
      category_id,
      access_level,
      test_series_id,
      exam_type_id,
      tags,
      // Pricing fields
      price,
      currency,
      is_free,
      discount_percentage,
      subscription_required,
      preview_pages
    } = req.body;
    const adminId = req.admin?.id;

    // console.log('📤 PDF Upload using multer');
    // console.log('📋 Request body:', req.body);
    // console.log('📁 Files:', req.files);

    // Check if file was uploaded using multer (any field name)
    if (!req.files || req.files.length === 0) {
      return next(new ErrorHandler('No PDF file provided', 400));
    }

    const uploadedFile = req.files[0]; // Get the first (and should be only) file

    // Validate file type
    if (uploadedFile.mimetype !== 'application/pdf') {
      return next(new ErrorHandler('Only PDF files are allowed', 400));
    }

    // Validate file size — env-driven cap
    if (uploadedFile.size > PDF_UPLOAD_MAX_SIZE_BYTES) {
      return next(new ErrorHandler(`File size must be less than ${PDF_UPLOAD_MAX_SIZE_MB}MB`, 400));
    }

    // Validate minimum file size (PDFs are rarely < 100 bytes)
    const minSize = 100;
    if (uploadedFile.size < minSize) {
      // Delete the uploaded file
      if (fs.existsSync(uploadedFile.path)) {
        fs.unlinkSync(uploadedFile.path);
      }
      return next(new ErrorHandler('Invalid PDF file. File is too small to be a valid PDF (minimum 100 bytes).', 400));
    }

    // Validate PDF signature (should start with '%PDF-')
    const { validatePDFFile } = require('../../utils/pdfUpload');
    if (!validatePDFFile(uploadedFile.path)) {
      // Delete the uploaded file
      if (fs.existsSync(uploadedFile.path)) {
        fs.unlinkSync(uploadedFile.path);
      }
      return next(new ErrorHandler('Invalid PDF file. File does not have a valid PDF signature. Please upload a real PDF file, not a JSON or text file.', 400));
    }

    // Support both course_id (new) and category_id (legacy) for backward compatibility
    const courseId = course_id || category_id;

    if (!title || !courseId) {
      return next(new ErrorHandler('Title and course are required', 400));
    }

    // If course_id is provided, validate against TestSeries (courses)
    let validatedCategoryId = null;
    if (course_id) {
      const { TestSeries } = require('../../models');
      const course = await TestSeries.findOne({ where: { uuid: course_id } });
      if (!course) {
        return next(new ErrorHandler('Invalid course', 400));
      }
      validatedCategoryId = null;
    } else {
      // Legacy support: validate category exists
      const category = await PdfCategory.findByPk(category_id);
      if (!category) {
        return next(new ErrorHandler('Invalid category', 400));
      }
      validatedCategoryId = parseInt(category_id);
    }

    // File is already saved by multer middleware
    const filePath = uploadedFile.path;
    const filename = uploadedFile.filename;

    // console.log('✅ File saved to:', filePath);
    // console.log('📄 File size:', uploadedFile.size, 'bytes');

    try {
      // Create PDF record
      const pdf = await Pdfs.create({
        title,
        description,
        category_id: validatedCategoryId,
        access_level: access_level || 'free',
        test_series_id: course_id || test_series_id || null,
        exam_type_id: exam_type_id ? parseInt(exam_type_id) : null,
        tags: tags ? JSON.parse(tags) : null,
        uploaded_by: adminId,
        original_filename: uploadedFile.originalname,
        file_path: filePath,
        file_size: uploadedFile.size,
        mime_type: uploadedFile.mimetype,
        // Pricing fields - automatically set is_free based on access_level
        price: price ? parseFloat(price) : 0.00,
        currency: currency || 'INR',
        is_free: access_level === 'free',
        discount_percentage: discount_percentage ? parseFloat(discount_percentage) : 0.00,
        subscription_required: subscription_required !== undefined ? (subscription_required === 'true' || subscription_required === true) : false,
        preview_pages: preview_pages ? parseInt(preview_pages) : 0
      });

      // Fetch the created PDF with associations
      const createdPdf = await Pdfs.findByPk(pdf.id, {
        include: [
          {
            model: PdfCategory,
            as: 'category',
            attributes: ['id', 'name', 'color']
          },
          {
            model: Admin,
            as: 'uploader',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      res.status(201).json({
        success: true,
        message: 'PDF uploaded successfully',
        data: {
          ...createdPdf.toJSON(),
          formatted_file_size: formatFileSize(createdPdf.file_size)
        }
      });
    } catch (dbErr) {
      // Delete uploaded file if database operation fails
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw dbErr;
    }
  } catch (err) {
    console.error('Upload PDF error:', err);
    const error = new ErrorHandler('Failed to upload PDF', 500);
    return next(error);
  }
};

// Get all PDFs with filtering and pagination
exports.getPdfs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const category_id = req.query.category_id;
    const access_level = req.query.access_level;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';

    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = { is_active: true };
    
    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { original_filename: { [Op.like]: `%${search}%` } }
      ];
    }

    if (category_id) {
      whereClause.category_id = category_id;
    }

    if (access_level) {
      whereClause.access_level = access_level;
    }

    // Query PDFs with associations, but handle missing associations gracefully
    const { count, rows } = await Pdfs.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: PdfCategory,
          as: 'category',
          attributes: ['id', 'name', 'color', 'icon'],
          required: false
        }
      ],
      limit,
      offset,
      order: [[sortBy, sortOrder]]
    });

    // Format response with file sizes
    const pdfsWithFormattedSize = rows.map(pdf => ({
      ...pdf.toJSON(),
      formatted_file_size: formatFileSize(pdf.file_size)
    }));

    res.status(200).json({
      success: true,
      data: pdfsWithFormattedSize,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    console.error('Get PDFs error:', err);
    const error = new ErrorHandler('Failed to fetch PDFs', 500);
    return next(error);
  }
};

// Get single PDF
exports.getPdfById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const pdf = await Pdfs.findByPk(id, {
      include: [
        {
          model: PdfCategory,
          as: 'category',
          attributes: ['id', 'name', 'color', 'icon']
        },
        {
          model: Test_Series,
          as: 'testSeries',
          attributes: ['id', 'title'],
          required: false
        },
        {
          model: ExamType,
          as: 'examType',
          attributes: ['id', 'name'],
          required: false
        },
        {
          model: Admin,
          as: 'uploader',
          attributes: ['id', 'name', 'email'],
          required: false
        }
      ]
    });

    if (!pdf) {
      return next(new ErrorHandler('PDF not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        ...pdf.toJSON(),
        formatted_file_size: formatFileSize(pdf.file_size)
      }
    });
  } catch (err) {
    console.error('Get PDF by ID error:', err);
    const error = new ErrorHandler('Failed to fetch PDF', 500);
    return next(error);
  }
};

// Update PDF metadata
exports.updatePdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category_id,
      course_id, // Support both course_id and category_id for compatibility
      access_level,
      test_series_id,
      exam_type_id,
      tags,
      // Pricing fields
      price,
      currency,
      is_free,
      discount_percentage,
      subscription_required,
      preview_pages
    } = req.body;

    // Support both course_id (new) and category_id (legacy) for backward compatibility
    const finalCategoryId = course_id || category_id;

    const pdf = await Pdfs.findByPk(id);
    if (!pdf) {
      return next(new ErrorHandler('PDF not found', 404));
    }

    // Validate category if provided
    if (finalCategoryId) {
      const category = await PdfCategory.findByPk(finalCategoryId);
      if (!category) {
        return next(new ErrorHandler('Invalid category', 400));
      }
    }

    // Update PDF
    const updateData = {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(finalCategoryId && { category_id: parseInt(finalCategoryId) }),
      ...(test_series_id !== undefined && { test_series_id }),
      ...(exam_type_id !== undefined && { exam_type_id: exam_type_id ? parseInt(exam_type_id) : null }),
      ...(tags !== undefined && { tags: tags ? JSON.parse(tags) : null }),
      // Pricing fields
      ...(price !== undefined && { price: parseFloat(price) || 0.00 }),
      ...(currency !== undefined && { currency }),
      ...(discount_percentage !== undefined && { discount_percentage: parseFloat(discount_percentage) || 0.00 }),
      ...(subscription_required !== undefined && { subscription_required: subscription_required === 'true' || subscription_required === true }),
      ...(preview_pages !== undefined && { preview_pages: parseInt(preview_pages) || 0 })
    };

    // Set access_level and automatically determine is_free
    if (access_level) {
      updateData.access_level = access_level;
      updateData.is_free = access_level === 'free';
    }

    await pdf.update(updateData);

    // Fetch updated PDF with associations
    const updatedPdf = await Pdfs.findByPk(id, {
      include: [
        {
          model: PdfCategory,
          as: 'category',
          attributes: ['id', 'name', 'color']
        },
        {
          model: Admin,
          as: 'uploader',
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'PDF updated successfully',
      data: {
        ...updatedPdf.toJSON(),
        formatted_file_size: formatFileSize(updatedPdf.file_size)
      }
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

    // Delete file from filesystem
    deletePDFFile(pdf.file_path);

    // Delete database record
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

// Download PDF (increment download count)
exports.downloadPdf = async (req, res, next) => {
  try {
    const { id } = req.params;

    const pdf = await Pdfs.findByPk(id);
    if (!pdf || !pdf.is_active) {
      return next(new ErrorHandler('PDF not found', 404));
    }

    // Check if file exists
    if (!fs.existsSync(pdf.file_path)) {
      return next(new ErrorHandler('PDF file not found on server', 404));
    }

    // Increment download count
    await pdf.increment('download_count');

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.original_filename}"`);
    res.setHeader('Content-Length', pdf.file_size);

    // Stream the file
    const fileStream = fs.createReadStream(pdf.file_path);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Download PDF error:', err);
    const error = new ErrorHandler('Failed to download PDF', 500);
    return next(error);
  }
};

// Get PDF statistics
exports.getPdfStats = async (req, res, next) => {
  try {
    const [
      totalPdfs,
      totalDownloads,
      categoriesWithCounts,
      recentUploads
    ] = await Promise.all([
      // Total PDFs
      Pdfs.count({ where: { is_active: true } }),
      
      // Total downloads
      Pdfs.sum('download_count', { where: { is_active: true } }),
      
      // PDFs by category
      PdfCategory.findAll({
        where: { is_active: true },
        include: [{
          model: Pdfs,
          as: 'pdfs',
          where: { is_active: true },
          required: false,
          attributes: ['id']
        }],
        attributes: ['id', 'name', 'color']
      }),
      
      // Recent uploads
      Pdfs.findAll({
        where: { is_active: true },
        limit: 5,
        order: [['created_at', 'DESC']],
        include: [{
          model: PdfCategory,
          as: 'category',
          attributes: ['name', 'color']
        }],
        attributes: ['id', 'title', 'created_at', 'file_size']
      })
    ]);

    const categoryStats = categoriesWithCounts.map(cat => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      count: cat.pdfs?.length || 0
    }));

    res.status(200).json({
      success: true,
      data: {
        total_pdfs: totalPdfs,
        total_downloads: totalDownloads || 0,
        categories: categoryStats,
        recent_uploads: recentUploads.map(pdf => ({
          ...pdf.toJSON(),
          formatted_file_size: formatFileSize(pdf.file_size)
        }))
      }
    });
  } catch (err) {
    console.error('Get PDF stats error:', err);
    const error = new ErrorHandler('Failed to fetch PDF statistics', 500);
    return next(error);
  }
};