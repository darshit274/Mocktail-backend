const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ErrorHandler = require('../../utils/default/errorHandler');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/editor_images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `editor_${uniqueId}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
    }
  }
});

// Upload single image for rich text editor
exports.uploadEditorImage = async (req, res, next) => {
  try {
    const uploadSingle = upload.single('image');

    uploadSingle(req, res, function(err) {
      if (err) {
        console.error('Image upload error:', err);
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new ErrorHandler('File size too large. Maximum 5MB allowed.', 400));
          }
        }
        return next(new ErrorHandler(err.message || 'Image upload failed', 400));
      }

      if (!req.file) {
        return next(new ErrorHandler('No image file provided', 400));
      }

      // Generate public URL for the uploaded image
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
      const imageUrl = `${serverUrl}/uploads/editor_images/${req.file.filename}`;

      // console.log('✅ Image uploaded successfully:', {
//         filename: req.file.filename,
//         size: req.file.size,
//         url: imageUrl
//       });

      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          filename: req.file.filename,
          url: imageUrl,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    });

  } catch (error) {
    console.error('Upload controller error:', error);
    return next(new ErrorHandler('Image upload failed', 500));
  }
};

// Delete uploaded image
exports.deleteEditorImage = async (req, res, next) => {
  try {
    const { filename } = req.params;

    if (!filename) {
      return next(new ErrorHandler('Filename is required', 400));
    }

    const filePath = path.join(__dirname, '../../uploads/editor_images', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return next(new ErrorHandler('Image not found', 404));
    }

    // Delete the file
    fs.unlinkSync(filePath);

    // console.log('✅ Image deleted successfully:', filename);

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Delete image error:', error);
    return next(new ErrorHandler('Failed to delete image', 500));
  }
};

// Get list of uploaded images
exports.getEditorImages = async (req, res, next) => {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads/editor_images');

    if (!fs.existsSync(uploadsDir)) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const files = fs.readdirSync(uploadsDir);
    const images = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      })
      .map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          url: `${process.env.SERVER_URL || 'http://localhost:3000'}/uploads/editor_images/${file}`,
          size: stats.size,
          created_at: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.status(200).json({
      success: true,
      data: images
    });

  } catch (error) {
    console.error('Get images error:', error);
    return next(new ErrorHandler('Failed to get images', 500));
  }
};