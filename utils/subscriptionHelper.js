const { User, Subscription } = require('../models');
const { Op } = require('sequelize');

// Update user's subscription status based on their active subscriptions
const updateUserSubscriptionStatus = async (userId) => {
    try {
        const user = await User.findByPk(userId);
        if (!user) return;

        // Check for active subscriptions
        const activeSubscription = await Subscription.findOne({
            where: {
                user_id: userId,
                status: 'completed',
                [Op.or]: [
                    { expiry_date: null },
                    { expiry_date: { [Op.gt]: new Date() } }
                ]
            }
        });

        // Check for expired subscriptions
        const expiredSubscription = await Subscription.findOne({
            where: {
                user_id: userId,
                status: 'completed',
                expiry_date: { [Op.lte]: new Date() }
            }
        });

        // Update user's subscription status
        if (activeSubscription) {
            user.subscription_status = 'active';
        } else if (expiredSubscription) {
            user.subscription_status = 'expired';
        } else {
            user.subscription_status = 'none';
        }

        // Update total subscriptions count
        const totalSubscriptions = await Subscription.count({
            where: {
                user_id: userId,
                status: 'completed'
            }
        });
        user.total_subscriptions = totalSubscriptions;

        await user.save();
        return user;
    } catch (error) {
        console.error('Error updating user subscription status:', error);
        throw error;
    }
};

// Check all users' subscription status (for cron job)
const checkAllUsersSubscriptionStatus = async () => {
    try {
        // Find users with subscriptions that just expired
        const usersWithExpiredSubscriptions = await User.findAll({
            where: {
                subscription_status: 'active'
            },
            include: [{
                model: Subscription,
                as: 'subscriptions',
                where: {
                    status: 'completed',
                    expiry_date: { [Op.lte]: new Date() }
                },
                required: true
            }]
        });

        // Update each user's status
        for (const user of usersWithExpiredSubscriptions) {
            await updateUserSubscriptionStatus(user.uuid);
        }

        // console.log(`Updated subscription status for ${usersWithExpiredSubscriptions.length} users`);
    } catch (error) {
        console.error('Error checking all users subscription status:', error);
        throw error;
    }
};

// Get users with expiring subscriptions (for reminder emails)
const getUsersWithExpiringSubscriptions = async (daysBeforeExpiry = 7) => {
    try {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + daysBeforeExpiry);

        const users = await User.findAll({
            where: {
                subscription_status: 'active',
                subscription_expiry_reminder_sent: false
            },
            include: [{
                model: Subscription,
                as: 'subscriptions',
                where: {
                    status: 'completed',
                    expiry_date: {
                        [Op.and]: [
                            { [Op.gte]: new Date() },
                            { [Op.lte]: expiryDate }
                        ]
                    }
                },
                required: true
            }]
        });

        return users;
    } catch (error) {
        console.error('Error getting users with expiring subscriptions:', error);
        throw error;
    }
};

module.exports = {
    updateUserSubscriptionStatus,
    checkAllUsersSubscriptionStatus,
    getUsersWithExpiringSubscriptions
};