const ErrorHandler = require('../../utils/default/errorHandler');
const { Admin, User, Subscription, TestSeries } = require('../../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sendMail } = require("../../utils/verifyEmail");

// Admin login - Step 1: Verify credentials and send OTP
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find admin by email
        const admin = await Admin.findOne({ where: { email } });
        if (!admin) {
            return next(new ErrorHandler('Invalid email or password', 401));
        }

        // Check if admin is active
        if (!admin.isActive) {
            return next(new ErrorHandler('Account is deactivated. Contact system administrator.', 403));
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return next(new ErrorHandler('Invalid email or password', 401));
        }

        // Generate 6-digit OTP
        function generate6DigitOTP() {
            return Math.floor(100000 + Math.random() * 900000);
        }
        const otp = generate6DigitOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        // Save OTP to admin record
        admin.otp = otp.toString();
        admin.otpExpiry = otpExpiry;
        await admin.save();

        // Send OTP via email
        try {
            await sendMail({
                receiver: email,
                subject: `MockTale Admin - Login Verification Code`,
                content: 'content',
                service: null,
                host: "smtp.gmail.com",
                htmlContent: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f8;">
                  <div style="max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <h2 style="color: #333; text-align: center;">Admin Login Verification</h2>
                    <p>Hi <strong>${admin.name}</strong>,</p>
                    <p>Use the following code to complete your admin login:</p>
                    <h1 style="text-align: center; color: #007bff; letter-spacing: 4px; background-color: #f0f0f0; padding: 15px; border-radius: 8px;">${otp}</h1>
                    <p style="color: #666;">This verification code is valid for <strong>10 minutes</strong>. Please do not share it with anyone.</p>
                    <p style="color: #e74c3c; margin-top: 20px;"><strong>Security Notice:</strong> If you did not attempt to log in, please contact your system administrator immediately.</p>
                    <br/>
                    <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; ${new Date().getFullYear()} MockTale Academy - Admin Panel</p>
                  </div>
                </div>
              `,
                cc: null,
                bcc: null
            });
        } catch (error) {
            console.error("Error sending Admin OTP Email:", error);
            return next(new ErrorHandler("Failed to send verification code. Please try again.", 500));
        }

        res.status(200).json({
            success: true,
            message: 'Verification code sent to your email',
            data: {
                email: admin.email,
                requiresOTP: true
            }
        });
    } catch (err) {
        console.error('Admin login error:', err);
        const error = new ErrorHandler('Login failed', 500);
        return next(error);
    }
};

// Admin login - Step 2: Verify OTP and issue token
exports.verifyOTP = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        // Find admin by email
        const admin = await Admin.findOne({ where: { email } });
        if (!admin) {
            return next(new ErrorHandler('Admin not found', 404));
        }

        // Check if OTP exists
        if (!admin.otp || !admin.otpExpiry) {
            return next(new ErrorHandler('No verification code found. Please request a new one.', 400));
        }

        // Check if OTP has expired
        if (new Date() > new Date(admin.otpExpiry)) {
            admin.otp = null;
            admin.otpExpiry = null;
            await admin.save();
            return next(new ErrorHandler('Verification code has expired. Please login again.', 400));
        }

        // Verify OTP
        if (admin.otp !== otp.toString()) {
            return next(new ErrorHandler('Invalid verification code', 401));
        }

        // Clear OTP after successful verification and generate a new session ID
        // (invalidates any previous session on another device)
        const sessionId = require('crypto').randomUUID();
        admin.otp = null;
        admin.otpExpiry = null;
        admin.lastLogin = new Date();
        admin.current_session_id = sessionId;
        await admin.save();

        // Generate JWT token (includes sessionId to enforce single-device login)
        const payload = {
            id: admin.id,
            email: admin.email,
            role: admin.role,
            sessionId
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                admin: {
                    id: admin.id,
                    name: admin.name,
                    email: admin.email,
                    role: admin.role,
                    avatar: admin.avatar,
                    created_at: admin.created_at,
                    last_login: admin.lastLogin
                },
                token
            }
        });
    } catch (err) {
        console.error('Admin OTP verification error:', err);
        const error = new ErrorHandler('OTP verification failed', 500);
        return next(error);
    }
};

// Resend OTP
exports.resendOTP = async (req, res, next) => {
    try {
        const { email } = req.body;

        // Find admin by email
        const admin = await Admin.findOne({ where: { email } });
        if (!admin) {
            return next(new ErrorHandler('Admin not found', 404));
        }

        // Generate new 6-digit OTP
        function generate6DigitOTP() {
            return Math.floor(100000 + Math.random() * 900000);
        }
        const otp = generate6DigitOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        // Save OTP to admin record
        admin.otp = otp.toString();
        admin.otpExpiry = otpExpiry;
        await admin.save();

        // Send OTP via email
        try {
            await sendMail({
                receiver: email,
                subject: `MockTale Admin - New Verification Code`,
                content: 'content',
                service: null,
                host: "smtp.gmail.com",
                htmlContent: `
                <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f6f8;">
                  <div style="max-width: 500px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <h2 style="color: #333; text-align: center;">Admin Login Verification</h2>
                    <p>Hi <strong>${admin.name}</strong>,</p>
                    <p>Here is your new verification code:</p>
                    <h1 style="text-align: center; color: #007bff; letter-spacing: 4px; background-color: #f0f0f0; padding: 15px; border-radius: 8px;">${otp}</h1>
                    <p style="color: #666;">This verification code is valid for <strong>10 minutes</strong>. Please do not share it with anyone.</p>
                    <br/>
                    <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; ${new Date().getFullYear()} MockTale Academy - Admin Panel</p>
                  </div>
                </div>
              `,
                cc: null,
                bcc: null
            });
        } catch (error) {
            console.error("Error sending Admin OTP Email:", error);
            return next(new ErrorHandler("Failed to send verification code. Please try again.", 500));
        }

        res.status(200).json({
            success: true,
            message: 'New verification code sent to your email'
        });
    } catch (err) {
        console.error('Admin resend OTP error:', err);
        const error = new ErrorHandler('Failed to resend verification code', 500);
        return next(error);
    }
};

// Get admin profile
exports.getProfile = async (req, res, next) => {
    try {
        const admin = await Admin.findByPk(req.admin.id, {
            attributes: ['id', 'name', 'email', 'role', 'avatar', 'created_at', 'lastLogin', 'permissions']
        });

        if (!admin) {
            return next(new ErrorHandler('Admin not found', 404));
        }

        res.status(200).json({
            success: true,
            data: admin
        });
    } catch (err) {
        console.error('Get admin profile error:', err);
        const error = new ErrorHandler('Failed to fetch profile', 500);
        return next(error);
    }
};

// Admin logout — clears the session so the token cannot be reused
exports.logout = async (req, res, next) => {
    try {
        await Admin.update(
            { current_session_id: null },
            { where: { id: req.admin.id } }
        );
        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (err) {
        console.error('Admin logout error:', err);
        const error = new ErrorHandler('Logout failed', 500);
        return next(error);
    }
};

// Dashboard stats
exports.getDashboardStats = async (req, res, next) => {
    try {
        // Get total counts
        const totalStudents = await User.count();
        
        // Get counts from new test system models
        let totalTests = 0;
        let totalTestSeries = 0;
        let totalPDFs = 0;
        let totalQuestions = 0;
        let totalTestSessions = 0;
        
        try {
            const { Test, TestSeries, Question, TestSession, Pdfs } = require('../../models');
            
            // New test system counts
            if (Test) totalTests = await Test.count({ where: { is_active: true } });
            if (TestSeries) totalTestSeries = await TestSeries.count({ where: { is_active: true } });
            if (Question) totalQuestions = await Question.count({ where: { is_active: true } });
            if (TestSession) totalTestSessions = await TestSession.count();
            
            // PDF count
            if (Pdfs) totalPDFs = await Pdfs.count();
        } catch (modelError) {
            // console.log('Some models not available:', modelError.message);
        }

        // Get today's data
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const newRegistrationsToday = await User.count({
            where: {
                created_at: {
                    [require('sequelize').Op.gte]: today,
                    [require('sequelize').Op.lt]: tomorrow
                }
            }
        });

        const activeStudentsToday = await User.count({
            where: {
                lastLogin: {
                    [require('sequelize').Op.gte]: today,
                    [require('sequelize').Op.lt]: tomorrow
                }
            }
        });

        // Get subscription stats
        let totalSubscriptions = 0;
        let activeSubscriptions = 0;
        let totalRevenue = 0;
        
        try {
            totalSubscriptions = await Subscription.count({ where: { status: 'completed' } });
            activeSubscriptions = await Subscription.count({ 
                where: { 
                    status: 'completed',
                    [Op.or]: [
                        { expiry_date: null },
                        { expiry_date: { [Op.gt]: new Date() } }
                    ]
                } 
            });
            totalRevenue = await Subscription.sum('amount_paid', { where: { status: 'completed' } }) || 0;
        } catch (subError) {
            // console.log('Subscription stats error:', subError.message);
        }

        // Get today's test activity
        let testAttemptsToday = 0;
        try {
            if (TestSession) {
                testAttemptsToday = await TestSession.count({
                    where: {
                        created_at: {
                            [require('sequelize').Op.gte]: today,
                            [require('sequelize').Op.lt]: tomorrow
                        }
                    }
                });
            }
        } catch (sessionError) {
            // console.log('Test session stats error:', sessionError.message);
        }

        const stats = {
            total_students: totalStudents,
            total_tests: totalTests,
            total_test_series: totalTestSeries,
            total_questions: totalQuestions,
            total_test_sessions: totalTestSessions,
            total_pdfs: totalPDFs,
            total_subscriptions: totalSubscriptions,
            active_subscriptions: activeSubscriptions,
            total_revenue: totalRevenue,
            monthly_revenue: 0, // Will be calculated from payment records
            active_students_today: activeStudentsToday,
            new_registrations_today: newRegistrationsToday,
            test_attempts_today: testAttemptsToday
        };

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        const error = new ErrorHandler('Failed to fetch dashboard stats', 500);
        return next(error);
    }
};

// Get all students with pagination
exports.getStudents = async (req, res, next) => {
    try {
        const { Op } = require('sequelize');
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100); // cap at 100
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'created_at';
        const sortOrder = (req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const offset = (page - 1) * limit;

        const whereClause = {};

        // Search by username, email, or phone
        if (search) {
            whereClause[Op.or] = [
                { username: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
            ];
        }

        // Filter by active status
        if (req.query.is_active !== undefined && req.query.is_active !== '') {
            whereClause.isActive = req.query.is_active === 'true';
        }

        // Filter by email verification
        if (req.query.is_verified !== undefined && req.query.is_verified !== '') {
            whereClause.isEmailVerified = req.query.is_verified === 'true';
        }

        const allowedSortFields = ['username', 'email', 'created_at', 'isEmailVerified', 'isActive'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';

        const { count, rows } = await User.findAndCountAll({
            where: whereClause,
            attributes: ['uuid', 'username', 'email', 'phone', 'profileImage', 'isEmailVerified', 'isActive', 'created_at', 'device_id'],
            limit,
            offset,
            order: [[safeSortBy, sortOrder]]
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
        console.error('Get students error:', err);
        const error = new ErrorHandler('Failed to fetch students', 500);
        return next(error);
    }
};

// Export students data as CSV
exports.exportStudents = async (req, res, next) => {
    try {
        const search = req.query.search || '';

        const whereClause = {};

        if (search) {
            whereClause[Op.or] = [
                { username: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
            ];
        }

        if (req.query.is_active !== undefined && req.query.is_active !== '') {
            whereClause.isActive = req.query.is_active === 'true';
        }

        if (req.query.is_verified !== undefined && req.query.is_verified !== '') {
            whereClause.isEmailVerified = req.query.is_verified === 'true';
        }

        const students = await User.findAll({
            where: whereClause,
            attributes: ['uuid', 'username', 'email', 'phone', 'isEmailVerified', 'isActive', 'created_at'],
            order: [['created_at', 'DESC']]
        });

        const csvHeader = 'UUID,Username,Email,Phone,Verified,Active,Joined\n';
        const csvRows = students.map(student => {
            return [
                student.uuid,
                `"${(student.username || '').replace(/"/g, '""')}"`,
                student.email,
                student.phone || '',
                student.isEmailVerified ? 'Yes' : 'No',
                student.isActive ? 'Yes' : 'No',
                new Date(student.created_at).toISOString().split('T')[0]
            ].join(',');
        }).join('\n');

        const csv = csvHeader + csvRows;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=students_${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csv);
    } catch (err) {
        console.error('Export students error:', err);
        const error = new ErrorHandler('Failed to export students', 500);
        return next(error);
    }
};

// Get single student by ID
exports.getStudentById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const student = await User.findOne({
            where: { uuid: id },
            attributes: ['uuid', 'username', 'email', 'phone', 'profileImage', 'created_at']
        });

        if (!student) {
            return next(new ErrorHandler('Student not found', 404));
        }

        res.status(200).json({
            success: true,
            data: student
        });
    } catch (err) {
        console.error('Get student error:', err);
        const error = new ErrorHandler('Failed to fetch student', 500);
        return next(error);
    }
};

// Update student
exports.updateStudent = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { username, email, phone, isEmailVerified } = req.body;

        const student = await User.findOne({ where: { uuid: id } });
        if (!student) {
            return next(new ErrorHandler('Student not found', 404));
        }

        // Check if email is already taken by another user
        if (email && email !== student.email) {
            const existingUser = await User.findOne({ 
                where: { 
                    email,
                    uuid: { [require('sequelize').Op.ne]: id }
                }
            });
            if (existingUser) {
                return next(new ErrorHandler('Email already exists', 400));
            }
        }

        // Check if username is already taken by another user
        if (username && username !== student.username) {
            const existingUser = await User.findOne({ 
                where: { 
                    username,
                    uuid: { [require('sequelize').Op.ne]: id }
                }
            });
            if (existingUser) {
                return next(new ErrorHandler('Username already exists', 400));
            }
        }

        // Update student
        await student.update({
            ...(username && { username }),
            ...(email && { email }),
            ...(phone !== undefined && { phone }),
            ...(isEmailVerified !== undefined && { isEmailVerified })
        });

        res.status(200).json({
            success: true,
            message: 'Student updated successfully',
            data: {
                uuid: student.uuid,
                username: student.username,
                email: student.email,
                phone: student.phone,
                isEmailVerified: student.isEmailVerified,
                isActive: student.isActive,
                created_at: student.created_at
            }
        });
    } catch (err) {
        console.error('Update student error:', err);
        const error = new ErrorHandler('Failed to update student', 500);
        return next(error);
    }
};

// Delete student
exports.deleteStudent = async (req, res, next) => {
    try {
        const { id } = req.params;

        const student = await User.findOne({ where: { uuid: id } });
        if (!student) {
            return next(new ErrorHandler('Student not found', 404));
        }

        await student.destroy();

        res.status(200).json({
            success: true,
            message: 'Student deleted successfully'
        });
    } catch (err) {
        console.error('Delete student error:', err);
        const error = new ErrorHandler('Failed to delete student', 500);
        return next(error);
    }
};

// Create new student (admin only)
exports.createStudent = async (req, res, next) => {
    try {
        const { username, email, password, phone } = req.body;

        // Validate required fields
        if (!username || !email || !password) {
            return next(new ErrorHandler('Username, email and password are required', 400));
        }

        // Check if user already exists
        const existingUser = await User.findOne({ 
            where: { 
                [require('sequelize').Op.or]: [
                    { email },
                    { username }
                ]
            }
        });
        
        if (existingUser) {
            return next(new ErrorHandler('User with this email or username already exists', 400));
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await User.create({
            username,
            email,
            password: hashedPassword,
            phone: phone || null
        });

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            data: {
                uuid: newUser.uuid,
                username: newUser.username,
                email: newUser.email,
                phone: newUser.phone,
                created_at: newUser.created_at
            }
        });
    } catch (err) {
        console.error('Create student error:', err);
        const error = new ErrorHandler('Failed to create student', 500);
        return next(error);
    }
};

// Create new admin (super admin only)
exports.createAdmin = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if requesting admin has permission
        if (req.admin.role !== 'super_admin') {
            return next(new ErrorHandler('Access denied. Super admin role required.', 403));
        }

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ where: { email } });
        if (existingAdmin) {
            return next(new ErrorHandler('Admin with this email already exists', 400));
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin
        const newAdmin = await Admin.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'admin'
        });

        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            data: {
                id: newAdmin.id,
                name: newAdmin.name,
                email: newAdmin.email,
                role: newAdmin.role,
                created_at: newAdmin.created_at
            }
        });
    } catch (err) {
        console.error('Create admin error:', err);
        const error = new ErrorHandler('Failed to create admin', 500);
        return next(error);
    }
};

// Analytics endpoints for dashboard
exports.getRegistrationAnalytics = async (req, res, next) => {
    try {
        const period = req.query.period || 'month';
        const { Op } = require('sequelize');
        
        let dateFormat, groupBy;
        let startDate = new Date();
        
        if (period === 'week') {
            startDate.setDate(startDate.getDate() - 7);
            dateFormat = '%Y-%m-%d';
            groupBy = 'DATE(created_at)';
        } else if (period === 'month') {
            startDate.setMonth(startDate.getMonth() - 6);
            dateFormat = '%Y-%m';
            groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
        } else {
            startDate.setFullYear(startDate.getFullYear() - 1);
            dateFormat = '%Y-%m';
            groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
        }

        const registrationData = await User.findAll({
            attributes: [
                [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), dateFormat), 'name'],
                [require('sequelize').fn('COUNT', require('sequelize').col('uuid')), 'value']
            ],
            where: {
                created_at: {
                    [Op.gte]: startDate
                }
            },
            group: [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), dateFormat)],
            order: [[require('sequelize').fn('DATE_FORMAT', require('sequelize').col('created_at'), dateFormat), 'ASC']]
        });

        res.status(200).json({
            success: true,
            data: registrationData
        });
    } catch (err) {
        console.error('Registration analytics error:', err);
        const error = new ErrorHandler('Failed to fetch registration analytics', 500);
        return next(error);
    }
};

exports.getTestAttemptAnalytics = async (req, res, next) => {
    try {
        const period = req.query.period || 'week';
        const { Op } = require('sequelize');
        
        let analyticsData = [];
        
        try {
            const { TestSession } = require('../../models');
            
            if (TestSession) {
                let dateFormat, groupBy;
                let startDate = new Date();
                
                if (period === 'week') {
                    startDate.setDate(startDate.getDate() - 7);
                    dateFormat = '%Y-%m-%d';
                    groupBy = 'DATE(created_at)';
                } else if (period === 'month') {
                    startDate.setMonth(startDate.getMonth() - 6);
                    dateFormat = '%Y-%m';
                    groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
                } else {
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    dateFormat = '%Y-%m';
                    groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
                }

                const testAttemptData = await TestSession.findAll({
                    attributes: [
                        [TestSession.sequelize.fn('DATE_FORMAT', TestSession.sequelize.col('created_at'), dateFormat), 'name'],
                        [TestSession.sequelize.fn('COUNT', TestSession.sequelize.col('id')), 'value']
                    ],
                    where: {
                        created_at: {
                            [Op.gte]: startDate
                        }
                    },
                    group: [TestSession.sequelize.fn('DATE_FORMAT', TestSession.sequelize.col('created_at'), dateFormat)],
                    order: [[TestSession.sequelize.fn('DATE_FORMAT', TestSession.sequelize.col('created_at'), dateFormat), 'ASC']],
                    raw: true
                });

                analyticsData = testAttemptData.map(item => ({
                    name: item.name,
                    value: parseInt(item.value)
                }));
            }
        } catch (modelError) {
            // console.log('Test attempt analytics model error:', modelError.message);
        }

        // Fallback to mock data if no real data available
        if (analyticsData.length === 0) {
            analyticsData = period === 'week' ? [
                { name: 'Mon', value: 45 },
                { name: 'Tue', value: 62 },
                { name: 'Wed', value: 78 },
                { name: 'Thu', value: 56 },
                { name: 'Fri', value: 89 },
                { name: 'Sat', value: 123 },
                { name: 'Sun', value: 67 }
            ] : [
                { name: 'Jan', value: 165 },
                { name: 'Feb', value: 289 },
                { name: 'Mar', value: 425 },
                { name: 'Apr', value: 356 },
                { name: 'May', value: 489 },
                { name: 'Jun', value: 623 }
            ];
        }

        res.status(200).json({
            success: true,
            data: analyticsData
        });
    } catch (err) {
        console.error('Test attempt analytics error:', err);
        const error = new ErrorHandler('Failed to fetch test attempt analytics', 500);
        return next(error);
    }
};

exports.getCategoryAnalytics = async (req, res, next) => {
    try {
        // Get actual category data from new test system
        let categoryData = [];
        
        try {
            const { ExamCategory, TestSeries } = require('../../models');
            
            if (ExamCategory && TestSeries) {
                const categories = await ExamCategory.findAll({
                    where: { 
                        is_active: true,
                        hierarchy_level: 0 // Only top-level categories
                    },
                    include: [{
                        model: TestSeries,
                        as: 'testSeries',
                        where: { is_active: true },
                        required: false,
                        attributes: []
                    }],
                    attributes: [
                        'name',
                        [TestSeries.sequelize.fn('COUNT', TestSeries.sequelize.col('testSeries.id')), 'value']
                    ],
                    group: ['ExamCategory.id', 'ExamCategory.name'],
                    order: [[TestSeries.sequelize.fn('COUNT', TestSeries.sequelize.col('testSeries.id')), 'DESC']]
                });

                categoryData = categories.map(cat => ({
                    name: cat.name,
                    value: parseInt(cat.getDataValue('value') || 0)
                }));
            }
        } catch (modelError) {
            // console.log('Category analytics model error:', modelError.message);
        }

        // Fallback to mock data if no real data available
        if (categoryData.length === 0) {
            categoryData = [
                { name: 'PSI Tests', value: 35 },
                { name: 'GPSC Tests', value: 25 },
                { name: 'NCERT Tests', value: 20 },
                { name: 'Other Tests', value: 20 }
            ];
        }

        res.status(200).json({
            success: true,
            data: categoryData
        });
    } catch (err) {
        console.error('Category analytics error:', err);
        const error = new ErrorHandler('Failed to fetch category analytics', 500);
        return next(error);
    }
};

exports.getRecentActivity = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const { Op } = require('sequelize');

        // Get recent user registrations
        const recentUsers = await User.findAll({
            attributes: ['username', 'email', 'created_at'],
            order: [['created_at', 'DESC']],
            limit: limit
        });

        // Format activity data
        const activities = recentUsers.map(user => ({
            action: 'New student registered',
            user: user.email,
            time: getRelativeTime(user.created_at),
            type: 'user'
        }));

        res.status(200).json({
            success: true,
            data: activities
        });
    } catch (err) {
        console.error('Recent activity error:', err);
        const error = new ErrorHandler('Failed to fetch recent activity', 500);
        return next(error);
    }
};

// Analytics: test attempts broken down per test series
exports.getTestSeriesAttemptAnalytics = async (req, res, next) => {
    try {
        const period = req.query.period || 'week';
        const { sequelize } = require('../../models');

        let startDate = new Date();
        if (period === 'month') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else {
            startDate.setDate(startDate.getDate() - 7);
        }

        const rows = await sequelize.query(`
            SELECT
                ts.id,
                ts.name,
                COUNT(sess.id)                                                                      AS total_attempts,
                SUM(CASE WHEN sess.status = 'completed' THEN 1 ELSE 0 END)                         AS completed_attempts,
                ROUND(AVG(CASE WHEN sess.status = 'completed' THEN sess.calculated_score ELSE NULL END), 1) AS avg_score
            FROM new_test_series ts
            LEFT JOIN categories c     ON c.test_series_id = ts.id
            LEFT JOIN sub_categories sc ON sc.category_id  = c.id
            LEFT JOIN tests t           ON t.sub_category_id = sc.id
            LEFT JOIN test_sessions sess ON sess.test_id = t.id
                                        AND sess.created_at >= :startDate
            WHERE ts.is_active = 1
            GROUP BY ts.id, ts.name
            HAVING COUNT(sess.id) > 0
            ORDER BY total_attempts DESC
            LIMIT 10
        `, {
            replacements: { startDate },
            type: sequelize.QueryTypes.SELECT
        });

        const data = rows.map(row => ({
            name: row.name,
            total_attempts: parseInt(row.total_attempts) || 0,
            completed_attempts: parseInt(row.completed_attempts) || 0,
            avg_score: parseFloat(row.avg_score) || 0,
            completion_rate: row.total_attempts > 0
                ? Math.round((parseInt(row.completed_attempts) / parseInt(row.total_attempts)) * 100)
                : 0
        }));

        res.status(200).json({ success: true, data });
    } catch (err) {
        console.error('Test series attempt analytics error:', err);
        return next(new ErrorHandler('Failed to fetch test series attempt analytics', 500));
    }
};

// Additional user management methods
exports.getUserStats = async (req, res, next) => {
    try {
        const totalStudents = await User.count();
        const activeStudents = await User.count({ where: { isActive: true } });
        const verifiedStudents = await User.count({ where: { isEmailVerified: true } });
        const premiumStudents = 0; // Field doesn't exist yet
        
        // Recent registrations (last week)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const recentRegistrations = await User.count({
            where: {
                created_at: {
                    [Op.gte]: weekAgo
                }
            }
        });

        res.status(200).json({
            success: true,
            data: {
                total_students: totalStudents,
                active_students: activeStudents,
                verified_students: verifiedStudents,
                premium_students: premiumStudents,
                new_students_this_week: recentRegistrations,
                unverified_students: totalStudents - verifiedStudents,
                total_test_attempts: 0, // Would need to be calculated from test attempts
                average_performance: 0 // Would need to be calculated from scores
            }
        });
    } catch (err) {
        console.error('User stats error:', err);
        const error = new ErrorHandler('Failed to fetch user statistics', 500);
        return next(error);
    }
};

exports.toggleUserStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const user = await User.findOne({ where: { uuid: id } });
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        user.isActive = !user.isActive;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            data: user
        });
    } catch (err) {
        console.error('Toggle user status error:', err);
        const error = new ErrorHandler('Failed to toggle user status', 500);
        return next(error);
    }
};

exports.verifyUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const user = await User.findOne({ where: { uuid: id } });
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        // Toggle verification status
        user.isEmailVerified = !user.isEmailVerified;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User ${user.isEmailVerified ? 'verified' : 'unverified'} successfully`,
            data: user
        });
    } catch (err) {
        console.error('Verify user error:', err);
        const error = new ErrorHandler('Failed to verify user', 500);
        return next(error);
    }
};

exports.toggleUserPremium = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const user = await User.findOne({ where: { uuid: id } });
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        // Premium field doesn't exist yet, return not implemented
        res.status(501).json({
            success: false,
            message: 'Premium status feature not implemented yet'
        });
    } catch (err) {
        console.error('Toggle user premium error:', err);
        const error = new ErrorHandler('Failed to toggle user premium status', 500);
        return next(error);
    }
};

// Reset a user's device lock — clears device_id so they can login from a new device
exports.resetUserDevice = async (req, res, next) => {
    try {
        const { id } = req.params;

        const user = await User.findOne({ where: { uuid: id } });
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        await user.update({ device_id: null });

        res.status(200).json({
            success: true,
            message: `Device lock removed for ${user.username}. They can now login from any device.`
        });
    } catch (err) {
        console.error('Reset user device error:', err);
        return next(new ErrorHandler('Failed to reset device lock', 500));
    }
};

// List test attempts grouped by student — one row per student with their latest
// attempt summary plus a total/completed count. Admin uses this to spot active
// students for paid-package follow-up; clicking a row opens the per-student
// history via getStudentTestAttemptsForAdmin below.
exports.getTestAttempts = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            status = 'all',
            dateFrom = '',
            dateTo = '',
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { TestSession, sequelize } = require('../../models');

        // Build session-level filters (status, date range)
        const sessionWhere = {};
        if (status && status !== 'all') sessionWhere.status = status;
        if (dateFrom || dateTo) {
            sessionWhere.created_at = {};
            if (dateFrom) sessionWhere.created_at[Op.gte] = new Date(dateFrom);
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999);
                sessionWhere.created_at[Op.lte] = toDate;
            }
        }

        // If admin is searching by user fields, narrow sessions to matching user_ids first
        const trimmedSearch = String(search).trim();
        if (trimmedSearch) {
            const like = `%${trimmedSearch}%`;
            const matchingUsers = await User.findAll({
                where: {
                    [Op.or]: [
                        { username: { [Op.like]: like } },
                        { email:    { [Op.like]: like } },
                        { phone:    { [Op.like]: like } },
                    ],
                },
                attributes: ['uuid'],
                raw: true,
            });
            const userIds = matchingUsers.map((u) => u.uuid);
            if (userIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 },
                });
            }
            sessionWhere.user_id = { [Op.in]: userIds };
        }

        // Total distinct students matching filters (for pagination)
        const totalStudents = await TestSession.count({
            where: sessionWhere,
            distinct: true,
            col: 'user_id',
        });

        // One row per user: count attempts + take the latest created_at
        const grouped = await TestSession.findAll({
            where: sessionWhere,
            attributes: [
                'user_id',
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_attempts'],
                [sequelize.fn('SUM', sequelize.literal('CASE WHEN is_completed = 1 THEN 1 ELSE 0 END')), 'completed_attempts'],
                [sequelize.fn('MAX', sequelize.col('created_at')), 'latest_created_at'],
            ],
            group: ['user_id'],
            order: [[sequelize.fn('MAX', sequelize.col('created_at')), 'DESC']],
            limit: parseInt(limit),
            offset,
            raw: true,
        });

        // Fetch the actual latest session row + user info for each grouped user
        const data = await Promise.all(grouped.map(async (g) => {
            const [latestSession, user] = await Promise.all([
                TestSession.findOne({
                    where: { ...sessionWhere, user_id: g.user_id },
                    order: [['created_at', 'DESC']],
                }),
                User.findOne({
                    where: { uuid: g.user_id },
                    attributes: ['uuid', 'username', 'email', 'phone', 'isEmailVerified', 'created_at'],
                }),
            ]);

            return {
                studentUuid: g.user_id,
                studentName: user?.username || null,
                studentEmail: user?.email || null,
                studentPhone: user?.phone || null,
                studentSignedUpAt: user?.created_at || null,
                totalAttempts: parseInt(g.total_attempts) || 0,
                completedAttempts: parseInt(g.completed_attempts) || 0,
                latestAttempt: latestSession ? {
                    sessionId: latestSession.id,
                    testName: latestSession.test_name,
                    categoryName: latestSession.category_name,
                    status: latestSession.status,
                    isCompleted: latestSession.is_completed,
                    isSubmitted: latestSession.is_submitted,
                    startedAt: latestSession.started_at,
                    completedAt: latestSession.completed_at,
                    createdAt: latestSession.created_at,
                    totalQuestions: latestSession.total_questions,
                    totalCorrect: latestSession.total_correct,
                    totalWrong: latestSession.total_wrong,
                    totalUnanswered: latestSession.total_unanswered,
                    percentage: latestSession.percentage,
                    finalScore: latestSession.final_score,
                    timeSpentSeconds: latestSession.time_spent_seconds,
                } : null,
            };
        }));

        res.status(200).json({
            success: true,
            data,
            pagination: {
                total: totalStudents,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalStudents / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error('Get test attempts error:', err);
        return next(new ErrorHandler('Failed to fetch test attempts', 500));
    }
};

// Get full test attempt history for a single student (admin view), including
// the test-series → category hierarchy so admin can see exactly what each
// attempt belongs to.
exports.getStudentTestAttemptsForAdmin = async (req, res, next) => {
    try {
        const { uuid } = req.params;
        const { TestSession, Category, TestSeries, Test, SubCategory } = require('../../models');

        const user = await User.findOne({
            where: { uuid },
            attributes: ['uuid', 'username', 'email', 'phone', 'isEmailVerified', 'isActive', 'created_at'],
        });
        if (!user) {
            return next(new ErrorHandler('Student not found', 404));
        }

        const sessions = await TestSession.findAll({
            where: { user_id: uuid },
            order: [['created_at', 'DESC']],
        });

        // Cache category lookups so we don't refetch for repeat tests
        const categoryCache = {};
        const buildHierarchy = async (session) => {
            // Prefer the category_uuid stored in session_data (new dynamic system)
            let categoryUuid = session.session_data?.category_uuid || null;

            // Fall back to the legacy Test → SubCategory → Category → TestSeries chain
            if (!categoryUuid && session.test_id) {
                try {
                    const oldTest = await Test.findByPk(session.test_id, {
                        include: [{
                            model: SubCategory,
                            as: 'subCategory',
                            include: [{
                                model: Category,
                                as: 'category',
                                include: [{ model: TestSeries, as: 'testSeries', attributes: ['uuid'] }],
                            }],
                        }],
                    });
                    if (oldTest?.subCategory?.category?.testSeries?.uuid) {
                        categoryUuid = oldTest.subCategory.category.testSeries.uuid;
                    }
                } catch (_) {
                    // ignore — legacy lookup is best-effort
                }
            }

            let seriesName = null;
            let parentCategoryNames = [];
            let categoryName = session.category_name || session.test_name || null;

            if (categoryUuid) {
                if (!categoryCache[categoryUuid]) {
                    categoryCache[categoryUuid] = await Category.findOne({
                        where: { uuid: categoryUuid },
                        include: [{
                            model: TestSeries,
                            as: 'testSeries',
                            attributes: ['uuid', 'name'],
                        }],
                        attributes: ['id', 'uuid', 'name', 'parent_category_id'],
                    });
                }
                const cat = categoryCache[categoryUuid];
                if (cat) {
                    seriesName = cat.testSeries?.name || null;
                    categoryName = cat.name || categoryName;
                    let parentId = cat.parent_category_id;
                    while (parentId) {
                        const parent = await Category.findByPk(parentId, {
                            attributes: ['id', 'name', 'parent_category_id'],
                        });
                        if (!parent) break;
                        parentCategoryNames.unshift(parent.name);
                        parentId = parent.parent_category_id;
                    }
                }
            }

            const parts = [];
            if (seriesName) parts.push(seriesName);
            parts.push(...parentCategoryNames);
            if (categoryName) parts.push(categoryName);

            return {
                seriesName,
                categoryName,
                subCategoryName: parentCategoryNames[parentCategoryNames.length - 1] || null,
                parentCategoryNames,
                hierarchyPath: parts.join(' → ') || (session.test_name || 'General'),
            };
        };

        const attempts = await Promise.all(sessions.map(async (s) => {
            const hierarchy = await buildHierarchy(s);
            return {
                sessionId: s.id,
                testName: s.test_name,
                categoryName: hierarchy.categoryName,
                seriesName: hierarchy.seriesName,
                subCategoryName: hierarchy.subCategoryName,
                hierarchyPath: hierarchy.hierarchyPath,
                status: s.status,
                isCompleted: s.is_completed,
                isSubmitted: s.is_submitted,
                startedAt: s.started_at,
                completedAt: s.completed_at,
                createdAt: s.created_at,
                totalQuestions: s.total_questions,
                totalCorrect: s.total_correct,
                totalWrong: s.total_wrong,
                totalUnanswered: s.total_unanswered,
                percentage: s.percentage,
                finalScore: s.final_score,
                timeSpentSeconds: s.time_spent_seconds,
            };
        }));

        // Summary stats
        const totalAttempts = attempts.length;
        const completedAttempts = attempts.filter((a) => a.isCompleted).length;
        const inProgressAttempts = attempts.filter((a) => a.status === 'active' || a.status === 'paused').length;
        const uniqueTests = new Set(attempts.map((a) => a.hierarchyPath).filter(Boolean)).size;
        const uniqueSeries = new Set(attempts.map((a) => a.seriesName).filter(Boolean)).size;
        const avgPercentage = (() => {
            const scored = attempts.filter((a) => a.isCompleted && a.percentage !== null);
            if (scored.length === 0) return null;
            const sum = scored.reduce((acc, a) => acc + parseFloat(a.percentage || 0), 0);
            return Math.round((sum / scored.length) * 10) / 10;
        })();

        res.status(200).json({
            success: true,
            data: {
                student: {
                    uuid: user.uuid,
                    name: user.username,
                    email: user.email,
                    phone: user.phone,
                    isEmailVerified: user.isEmailVerified,
                    isActive: user.isActive,
                    signedUpAt: user.created_at,
                },
                summary: {
                    totalAttempts,
                    completedAttempts,
                    inProgressAttempts,
                    uniqueTests,
                    uniqueSeries,
                    avgPercentage,
                },
                attempts,
            },
        });
    } catch (err) {
        console.error('Get student test attempts (admin) error:', err);
        return next(new ErrorHandler('Failed to fetch student test attempts', 500));
    }
};

// Helper function for relative time
const getRelativeTime = (date) => {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
};