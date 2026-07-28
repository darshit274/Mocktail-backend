const express = require('express');
const router = express.Router();
const pdfUploadController = require('../../controllers/AdminController/pdfUploadController');
const { adminAuth } = require('../../utils/AdminAuth');
const { handlePDFUpload } = require('../../utils/pdfUpload');

// PDF Categories routes
router.get('/categories', adminAuth, pdfUploadController.getPdfCategories);
router.post('/categories', adminAuth, pdfUploadController.createPdfCategory);

// PDF Upload routes
router.post('/upload', (req, res, next) => {
  // console.log('=== ROUTE HIT: PDF UPLOAD ===');
  // console.log('Time:', new Date().toISOString());
  // console.log('Method:', req.method);
  // console.log('URL:', req.url);
  next();
}, adminAuth, (req, res, next) => {
  // console.log('=== AUTH PASSED ===');
  // console.log('Admin ID:', req.admin?.id);
  next();
}, handlePDFUpload, pdfUploadController.uploadPdf);
router.get('/list', adminAuth, pdfUploadController.getPdfs);
router.get('/stats', adminAuth, pdfUploadController.getPdfStats);
router.get('/:id', adminAuth, pdfUploadController.getPdfById);
router.put('/:id', adminAuth, pdfUploadController.updatePdf);
router.delete('/:id', adminAuth, pdfUploadController.deletePdf);
router.get('/:id/download', adminAuth, pdfUploadController.downloadPdf);

module.exports = router;