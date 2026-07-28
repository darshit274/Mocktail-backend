const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types'); // need to instal this package for this



// Function to generate filename using timestamp (default)
const generateTimestampFilename = (file) => {
  const ext = path.extname(file.originalname);
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  return `${file.fieldname}-${uniqueSuffix}${ext}`;
};

// Set storage engine
const storage = (destination) => multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = `${destination}` || 'uploads/';


    // Ensure the directory exists
    fs.mkdir(uploadPath, { recursive: true }, (err) => {
      if (err) {
        console.error(err);
        return cb(err);
      }
      cb(null, uploadPath);
    });
  },
  filename: async (req, file, cb) => {
    const newFileName = await generateTimestampFilename(file); // to generate filename using timestamp
    cb(null, newFileName);
  },
});

// Check file type
const checkFileType = (file, extensions, cb) => {
  if (!extensions || extensions.length === 0) {
    // If no extensions are provided, allow any file
    cb(null, true);
  } else {
    const fileExt = path.extname(file.originalname).toLowerCase().slice(1); // Get file extension without dot
    const mimeType = file.mimetype;

    // Check if file's extension and mimetype match any of the allowed extensions
    const isExtensionValid = extensions.includes(fileExt);
    const isMimeTypeValid = extensions.some(ext => mimeType === getMimeTypeFromExtension(ext));

    if (isExtensionValid && isMimeTypeValid) {
      cb(null, true);
    } else {
      cb(new Error(`Please provide valid files with the following extensions: ${extensions.join(', ')}`));
    }
  }
};

// Improved getMimeTypeFromExtension using mime-types package
const getMimeTypeFromExtension = (extension) => {
  return mime.lookup(extension) || null;
};

// Middleware for file upload
exports.imageUpload = (extensions = null, fieldName = 'files', maxSize = null, destination = 'uploads/') => {
  return (req, res, next) => {
    const upload = multer({
      storage: storage(destination),
      limits: { fileSize: maxSize || null },
      fileFilter: (req, file, cb) => {
        checkFileType(file, extensions, cb);
      },
    }).array(fieldName);

    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }

      const files = req.files;

      // console.log('Uploaded files:', req.files);

      // If no files uploaded, skip deleting old files and continue
      if (!files || files.length === 0) {
        req.filePaths = req.body.old_files ? [req.body.old_files] : [];
        return next();
      }

      // Delete old files if new ones are uploaded
      if (files.length > 0 && req.body.old_files) {
        const oldFiles = Array.isArray(req.body.old_files) ? req.body.old_files : [req.body.old_files];
        oldFiles.forEach(oldFile => {
          fs.unlink(path.join(destination, oldFile), (error) => {
            if (error) {
              console.error(`Error deleting old file:`, error);
            } else {
              // console.log(`Old file deleted successfully`);
            }
          });
        });
      }



      // Attach file paths to the request object
      req.filePaths = files.map(file => {
        let relPath = path.posix.join(destination, file.filename);
        if (!relPath.startsWith('/')) relPath = '/' + relPath;
        return relPath;
      });
      next();
    });
  };
};