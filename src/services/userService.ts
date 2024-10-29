import User, { IUser } from '../models/User';
import { generateReferralCode } from '../utils/referralCode';

// Reward constants
const REWARDS = {
    WELCOME: 500,
    DAILY_STREAK: 100,
    PREMIUM_USER: 1000,
    ACCOUNT_AGE: {
        ONE_WEEK: 1000,
        ONE_MONTH: 4000
    }
};

export async function createOrFetchUser(userData: any): Promise<IUser> {
    try {
        let user = await User.findOne({ telegramId: userData.id });
        if (!user) {
            try {
                const now = new Date();
                user = new User({
                    telegramId: userData.id,
                    username: userData.username,
                    firstName: userData.first_name,
                    lastName: userData.last_name,
                    isPremium: userData.is_premium || false,
                    referralCode: generateReferralCode(),
                    lastVisit: now,  // Initialize lastVisit
                    createdAt: now,  // Initialize createdAt
                    rewardHistory: {
                        accountAge: { lastCalculated: now, totalAwarded: 0 },
                        premium: { lastCalculated: now, totalAwarded: 0 },
                        dailyCheckin: { lastCalculated: now, totalAwarded: 0 }
                    }
                });
                await user.save();
            } catch (error: any) {
                if (error.code === 11000) {
                    user = await User.findOne({ telegramId: userData.id });
                    if (!user) {
                        throw new Error('Failed to create or fetch user');
                    }
                } else {
                    throw error;
                }
            }
        }

        return user;
    } catch (error: any) {
        console.error('Error in createOrFetchUser:', error);
        throw error;
    }
}

export const awardWelcomeToken = async (telegramId: number): Promise<IUser> => {
    const user = await User.findOne({ telegramId });
    if (!user) {
        throw new Error('User not found');
    }

    if (user.tokens === 0) {
        user.tokens = REWARDS.WELCOME;
        user.currentStreak = 1;
        // Initialize lastVisit if it doesn't exist
        if (!user.lastVisit) {
            user.lastVisit = new Date();
        }
        await user.save();
    }

    return user;
};

export const checkAndUpdateDailyStreak = async (telegramId: number): Promise<IUser> => {
    const user = await User.findOne({ telegramId });
    if (!user) {
        throw new Error('User not found');
    }

    const now = new Date();

    // Initialize lastVisit if it doesn't exist
    if (!user.lastVisit) {
        user.lastVisit = now;
        user.currentStreak = 1;
        await user.save();
        return user;
    }

    const lastVisit = new Date(user.lastVisit);

    // Convert dates to midnight for comparison
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastVisitDate = new Date(lastVisit.getFullYear(), lastVisit.getMonth(), lastVisit.getDate());

    // Calculate days difference
    const daysDifference = Math.floor((nowDate.getTime() - lastVisitDate.getTime()) / (1000 * 3600 * 24));

    let rewardAmount = 0;

    if (daysDifference === 1) {
        // Consecutive day
        user.currentStreak += 1;
        rewardAmount = REWARDS.DAILY_STREAK;
    } else if (daysDifference > 1) {
        // Streak broken
        user.currentStreak = 1;
        rewardAmount = REWARDS.DAILY_STREAK;
    }

    if (rewardAmount > 0) {
        user.tokens += rewardAmount;
        if (user.rewardHistory?.dailyCheckin) {
            user.rewardHistory.dailyCheckin.totalAwarded += rewardAmount;
            user.rewardHistory.dailyCheckin.lastCalculated = now;
        } else {
            user.rewardHistory = {
                ...user.rewardHistory,
                dailyCheckin: {
                    lastCalculated: now,
                    totalAwarded: rewardAmount
                }
            };
        }
    }

    // Initialize createdAt if it doesn't exist
    if (!user.createdAt) {
        user.createdAt = now;
    }

    // Check account age rewards
    const accountAge = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 3600 * 24));
    if (accountAge >= 30 && (!user.rewardHistory?.accountAge?.totalAwarded || user.rewardHistory.accountAge.totalAwarded < REWARDS.ACCOUNT_AGE.ONE_MONTH)) {
        user.tokens += REWARDS.ACCOUNT_AGE.ONE_MONTH;
        if (user.rewardHistory?.accountAge) {
            user.rewardHistory.accountAge.totalAwarded = REWARDS.ACCOUNT_AGE.ONE_MONTH;
            user.rewardHistory.accountAge.lastCalculated = now;
        }
    } else if (accountAge >= 7 && (!user.rewardHistory?.accountAge?.totalAwarded || user.rewardHistory.accountAge.totalAwarded < REWARDS.ACCOUNT_AGE.ONE_WEEK)) {
        user.tokens += REWARDS.ACCOUNT_AGE.ONE_WEEK;
        if (user.rewardHistory?.accountAge) {
            user.rewardHistory.accountAge.totalAwarded = REWARDS.ACCOUNT_AGE.ONE_WEEK;
            user.rewardHistory.accountAge.lastCalculated = now;
        }
    }

    // Check premium rewards
    if (user.isPremium && (!user.rewardHistory?.premium?.lastCalculated ||
        Math.floor((now.getTime() - user.rewardHistory.premium.lastCalculated.getTime()) / (1000 * 3600 * 24)) >= 30)) {
        user.tokens += REWARDS.PREMIUM_USER;
        if (user.rewardHistory?.premium) {
            user.rewardHistory.premium.totalAwarded += REWARDS.PREMIUM_USER;
            user.rewardHistory.premium.lastCalculated = now;
        }
    }

    user.lastVisit = now;
    await user.save();

    return user;
};