const express = require('express');
const router = express.Router();

const adminController = require('../../controllers/AdminController/adminController');
const questionsController = require('../../controllers/AdminController/questionsController');
const pdfController = require('../../controllers/AdminController/pdfController');
const examTypesController = require('../../controllers/AdminController/examTypesController');
const categoriesController = require('../../controllers/AdminController/categoriesController');
const notificationController = require('../../controllers/AdminController/notificationController');
const { adminAuth, requireRole } = require('../../utils/AdminAuth');

// Public routes (no authentication required)
router.post('/login', adminController.login);
router.post('/verify-otp', adminController.verifyOTP);
router.post('/resend-otp', adminController.resendOTP);

// Protected routes (authentication required)
router.post('/logout', adminAuth, adminController.logout);
router.get('/profile', adminAuth, adminController.getProfile);
router.get('/dashboard/stats', adminAuth, adminController.getDashboardStats);

// Analytics routes
router.get('/analytics/registrations', adminAuth, adminController.getRegistrationAnalytics);
router.get('/analytics/test-attempts', adminAuth, adminController.getTestAttemptAnalytics);
router.get('/analytics/categories', adminAuth, adminController.getCategoryAnalytics);
router.get('/analytics/recent-activity', adminAuth, adminController.getRecentActivity);
router.get('/analytics/test-series-attempts', adminAuth, adminController.getTestSeriesAttemptAnalytics);

// Test attempts list — who is taking which test (for admin follow-up on paid packages)
router.get('/test-attempts', adminAuth, adminController.getTestAttempts);
// Full attempt history for one student (used by the "View" button on the Test Attempts page)
router.get('/users/:uuid/test-attempts', adminAuth, adminController.getStudentTestAttemptsForAdmin);

// Student management routes (alias for users)
router.get('/students', adminAuth, adminController.getStudents);
router.get('/students/:id', adminAuth, adminController.getStudentById);
router.post('/students', adminAuth, adminController.createStudent);
router.put('/students/:id', adminAuth, adminController.updateStudent);
router.delete('/students/:id', adminAuth, adminController.deleteStudent);

// User management routes (same as students, for frontend compatibility)
router.get('/users', adminAuth, adminController.getStudents);
router.get('/users/stats', adminAuth, adminController.getUserStats);
router.get('/users/export', adminAuth, adminController.exportStudents);
router.get('/users/:id', adminAuth, adminController.getStudentById);
router.post('/users', adminAuth, adminController.createStudent);
router.put('/users/:id', adminAuth, adminController.updateStudent);
router.delete('/users/:id', adminAuth, adminController.deleteStudent);
router.patch('/users/:id/toggle-status', adminAuth, adminController.toggleUserStatus);
router.patch('/users/:id/verify', adminAuth, adminController.verifyUser);
router.patch('/users/:id/toggle-premium', adminAuth, adminController.toggleUserPremium);
router.patch('/users/:id/reset-device', adminAuth, adminController.resetUserDevice);


// Questions management routes
router.get('/questions', adminAuth, questionsController.getQuestions);
router.get('/questions/stats', adminAuth, questionsController.getQuestionsStats);
router.post('/questions/stats', adminAuth, questionsController.upload.single('file'), questionsController.getQuestionsStats);

// Question import status endpoint
router.get('/questions/import/status/:importId', adminAuth, questionsController.getImportStatus);

// Get import preview data
router.get('/questions/import/preview/:importId', adminAuth, questionsController.getImportPreview);

// Confirm and complete import
router.post('/questions/import/confirm/:importId', adminAuth, questionsController.confirmImport);
router.get('/questions/filters', adminAuth, questionsController.getQuestionFilters);

// Import template routes - MUST come before /questions/:id
router.get('/questions/template-excel', adminAuth, questionsController.downloadExcelTemplate);
router.get('/questions/template-csv', adminAuth, questionsController.downloadCsvTemplate);

router.get('/questions/:id', adminAuth, questionsController.getQuestionById);
router.post('/questions', adminAuth, questionsController.createQuestion);
router.post('/questions/bulk', adminAuth, questionsController.bulkCreateQuestions);
router.put('/questions/:id', adminAuth, questionsController.updateQuestion);
router.delete('/questions/:id', adminAuth, questionsController.deleteQuestion);

// PDF management routes
router.get('/pdfs', adminAuth, pdfController.getPdfs);
router.get('/pdfs/stats', adminAuth, pdfController.getPdfStats);
router.get('/pdfs/filters', adminAuth, pdfController.getPdfFilters);
router.get('/pdfs/:id', adminAuth, pdfController.getPdfById);
router.get('/pdfs/:id/download', adminAuth, pdfController.getPdfDownloadUrl);
router.post('/pdfs', adminAuth, pdfController.createPdf);
router.post('/pdfs/upload', adminAuth, pdfController.uploadPdf);
router.put('/pdfs/:id', adminAuth, pdfController.updatePdf);
router.delete('/pdfs/:id', adminAuth, pdfController.deletePdf);

// PDF list route (backward compatibility) - REMOVED due to conflict with pdfUploadRoutes
// router.get('/pdf/list', adminAuth, pdfController.getPdfs);


// Exam Types management routes
router.get('/exam-types', adminAuth, examTypesController.getExamTypes);
router.get('/exam-types/dropdown', adminAuth, examTypesController.getExamTypesForDropdown);
router.get('/exam-types/:id', adminAuth, examTypesController.getExamTypeById);
router.post('/exam-types', adminAuth, examTypesController.createExamType);
router.put('/exam-types/:id', adminAuth, examTypesController.updateExamType);
router.delete('/exam-types/:id', adminAuth, examTypesController.deleteExamType);

// Categories management routes
router.get('/categories', adminAuth, categoriesController.getCategories);
router.get('/categories/stats', adminAuth, categoriesController.getCategoryStats);
router.get('/categories/dropdown', adminAuth, categoriesController.getCategoriesForDropdown);
router.get('/categories/:id', adminAuth, categoriesController.getCategoryById);
router.post('/categories', adminAuth, categoriesController.createCategory);
router.put('/categories/:id', adminAuth, categoriesController.updateCategory);
router.delete('/categories/:id', adminAuth, categoriesController.deleteCategory);
router.patch('/categories/:id/toggle-status', adminAuth, categoriesController.toggleCategoryStatus);

// Notification management routes
router.get('/notifications/stats', adminAuth, notificationController.getNotificationStats);
router.get('/notifications/history', adminAuth, notificationController.getNotificationHistory);
router.post('/notifications/broadcast', adminAuth, notificationController.sendBroadcastNotification);
router.post('/notifications/targeted', adminAuth, notificationController.sendTargetedNotification);
router.post('/notifications/trigger-content', adminAuth, notificationController.triggerNewContentNotification);
router.post('/notifications/schedule', adminAuth, notificationController.scheduleNotification);
router.delete('/notifications/schedule/:jobId', adminAuth, notificationController.cancelScheduledNotification);
router.post('/notifications/test', adminAuth, notificationController.sendTestNotification);

// Subscription management routes (admin access)
const subscriptionController = require('../../controllers/SubscriptionController/subscriptionController');
router.get('/subscriptions', adminAuth, subscriptionController.getAllSubscriptions);
router.get('/subscriptions/stats', adminAuth, subscriptionController.getSubscriptionStats);
router.get('/subscriptions/export', adminAuth, subscriptionController.exportSubscriptions);
router.get('/subscriptions/:id', adminAuth, subscriptionController.getSubscriptionDetails);
router.patch('/subscriptions/:id/status', adminAuth, subscriptionController.updateSubscriptionStatus);
router.post('/subscriptions/manual', adminAuth, subscriptionController.createManualSubscription);

// PDF Upload management routes
const pdfUploadRoutes = require('./pdfUploadRoutes');
router.use('/pdf', pdfUploadRoutes);

// PDF Hierarchy (categories with sub-categories tree) — admin endpoints
const pdfHierarchyRoutes = require('./pdfHierarchyRoutes');
router.use('/pdf-hierarchy', pdfHierarchyRoutes);

// PYQ management routes
const pyqRoutes = require('./pyqRoutes');
router.use('/pyqs', pyqRoutes);

// Translation management routes
const translationRoutes = require('./translationRoutes');
router.use('/translations', translationRoutes);

// Test management routes (NEW SYSTEM)
const testManagementRoutes = require('../testManagementRoutes');
router.use('/test-management', testManagementRoutes);



// Admin management routes (super admin only)
router.post('/create', adminAuth, requireRole(['super_admin']), adminController.createAdmin);

module.exports = router;