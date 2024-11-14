// src/routes/userRoutes.ts
import express from 'express';
import {
    awardWelcomeToken,
    checkAndUpdateDailyStreak,
    createOrFetchUser,
    getInitials,
    getUserRank,
    getUserWithFriends
} from '../services/userService';
import {validateTelegramWebAppData} from '../utils/telegramAuth';
import User from '../models/User';


const router = express.Router();

router.post('/authenticate', async (req, res) => {
    try {
        const {initData} = req.body;
        const validatedData = validateTelegramWebAppData(initData);

        if (!validatedData) {
            console.log('invalid authentication data');
            return res.status(401).json({message: 'Invalid authentication data'});
        }
        const user = await createOrFetchUser(validatedData.user);
        res.json(user);
    } catch (error: any) {
        console.error('Error in /authenticate:', error);
        if (error.message === 'Failed to create or fetch user') {
            res.status(500).json({message: 'Unable to create or fetch user. Please try again.'});
        } else {
            res.status(500).json({message: 'Error authenticating user'});
        }
    }
});

router.post('/welcome-token', async (req, res) => {
    try {
        const {telegramId} = req.body;
        const user = await awardWelcomeToken(telegramId);
        res.json(user);
    } catch (error) {
        res.status(500).json({message: 'Error awarding welcome token'});
    }
});

router.post('/daily-streak', async (req, res) => {
    try {
        const {telegramId} = req.body;
        const user = await checkAndUpdateDailyStreak(telegramId);
        res.json(user);
    } catch (error) {
        console.log('exception in daily-streak', error);
        res.status(500).json({message: 'Error checking daily streak'});
    }
});

// New endpoint for home page data


router.get('/home/:telegramId', async (req, res) => {
    try {
        const {telegramId} = req.params;
        const user = await User.findOne({telegramId}); //await checkAndUpdateDailyStreak(Number(telegramId));
        if (!user) {
            console.error(`Could not find user by id:${telegramId}`)
            res.status(404).json({message: 'Could not find user'});
            return;
        }
        const rank = await getUserRank(Number(telegramId));

        // Format the response according to the home page needs
        const response = {
            user: {
                username: user.username,
                firstName: user.firstName,
                balance: user.tokens,
                initials: getInitials(user.firstName, user.lastName, user.username),
                rank: rank,
                profilePhoto: user.profilePhoto ? {
                    smallFileUrl: user.profilePhoto.smallFileUrl,
                    largeFileUrl: user.profilePhoto.largeFileUrl
                } : undefined
            },
            rewards: {
                dailyCheckin: {
                    amount: user.rewardHistory?.dailyCheckin?.totalAwarded || 0,
                    lastCalculated: user.rewardHistory?.dailyCheckin?.lastCalculated
                },
                invitedFriends: {
                    amount: user.rewardHistory?.referrals?.totalAwarded || 0,
                    count: await User.countDocuments({referredByCode: user.referralCode})
                }
            },
            stats: {
                currentStreak: user.currentStreak,
                isPremium: user.isPremium
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching home data:', error);
        res.status(500).json({message: 'Error fetching home data'});
    }
});

router.get('/friends/:telegramId', async (req, res) => {
    try {
        const {telegramId} = req.params;
        const friendsData = await getUserWithFriends(Number(telegramId));
        res.json(friendsData);
    } catch (error) {
        console.error('Error fetching friends data:', error);
        if (error instanceof Error && error.message === 'User not found') {
            res.status(404).json({message: 'User not found'});
        } else {
            res.status(500).json({message: 'Error fetching friends data'});
        }
    }
});

export default router;