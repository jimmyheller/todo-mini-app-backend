// src/services/userService.ts
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

interface FriendsResponse {
    user: {
        username: string;
        balance: number;
        rank: string;
        referralCode: string;
        initials: string;
    };
    friends: Array<{
        username: string;
        balance: number;
        initials: string;
    }>;
}

const initializeRewardHistory = (date: Date) => ({
    accountAge: { lastCalculated: date, totalAwarded: 0 },
    premium: { lastCalculated: date, totalAwarded: 0 },
    dailyCheckin: { lastCalculated: date, totalAwarded: 0 },
    referrals: { lastCalculated: date, totalAwarded: 0 }
});

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
                    lastVisit: now,
                    createdAt: now,
                    tokens: 0,
                    currentStreak: 0,
                    rewardHistory: initializeRewardHistory(now)
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

        // Ensure all required fields exist
        const now = new Date();
        if (!user.rewardHistory) {
            user.rewardHistory = initializeRewardHistory(now);
        }
        if (!user.lastVisit) {
            user.lastVisit = now;
        }
        if (!user.createdAt) {
            user.createdAt = now;
        }
        if (typeof user.tokens !== 'number') {
            user.tokens = 0;
        }
        if (typeof user.currentStreak !== 'number') {
            user.currentStreak = 0;
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

    const now = new Date();
    if (!user.rewardHistory) {
        user.rewardHistory = initializeRewardHistory(now);
    }

    if (!user.tokens || user.tokens === 0) {
        user.tokens = REWARDS.WELCOME;
        user.currentStreak = 1;
        user.lastVisit = now;
        await user.save();
    }

    return user;
};

export const checkAndUpdateDailyStreak = async (telegramId: number): Promise<IUser> => {
    console.log('Starting checkAndUpdateDailyStreak for telegramId:', telegramId);

    const user = await User.findOne({ telegramId });
    if (!user) {
        throw new Error('User not found');
    }

    const now = new Date();
    console.log('Current time:', now);

    // Initialize or fix missing data
    if (!user.rewardHistory) {
        console.log('Initializing reward history');
        user.rewardHistory = initializeRewardHistory(now);
    }
    if (!user.lastVisit) {
        console.log('Initializing lastVisit');
        user.lastVisit = now;
    }
    if (!user.createdAt) {
        console.log('Initializing createdAt');
        user.createdAt = now;
    }
    if (typeof user.currentStreak !== 'number') {
        console.log('Initializing currentStreak');
        user.currentStreak = 0;
    }
    if (typeof user.tokens !== 'number') {
        console.log('Initializing tokens');
        user.tokens = 0;
    }

    // Ensure rewardHistory has all required properties
    Object.keys(initializeRewardHistory(now)).forEach(key => {
        if (!user.rewardHistory[key]) {
            console.log(`Initializing missing reward history for ${key}`);
            user.rewardHistory[key] = { lastCalculated: now, totalAwarded: 0 };
        }
    });

    const lastVisit = new Date(user.lastVisit);
    console.log('Last visit:', lastVisit);

    // Convert dates to midnight for comparison
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastVisitDate = new Date(lastVisit.getFullYear(), lastVisit.getMonth(), lastVisit.getDate());
    console.log('Comparing dates:', { nowDate, lastVisitDate });

    const daysDifference = Math.floor((nowDate.getTime() - lastVisitDate.getTime()) / (1000 * 3600 * 24));
    console.log('Days difference:', daysDifference);

    let rewardAmount = 0;

    if (daysDifference === 1) {
        user.currentStreak += 1;
        rewardAmount = REWARDS.DAILY_STREAK;
    } else if (daysDifference > 1) {
        user.currentStreak = 1;
        rewardAmount = REWARDS.DAILY_STREAK;
    }

    // Update rewards
    if (rewardAmount > 0) {
        user.tokens += rewardAmount;
        user.rewardHistory.dailyCheckin.totalAwarded += rewardAmount;
        user.rewardHistory.dailyCheckin.lastCalculated = now;
    }

    // Check account age rewards
    try {
        const accountAge = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 3600 * 24));
        console.log('Account age in days:', accountAge);

        if (accountAge >= 30 && user.rewardHistory.accountAge.totalAwarded < REWARDS.ACCOUNT_AGE.ONE_MONTH) {
            user.tokens += REWARDS.ACCOUNT_AGE.ONE_MONTH;
            user.rewardHistory.accountAge.totalAwarded = REWARDS.ACCOUNT_AGE.ONE_MONTH;
            user.rewardHistory.accountAge.lastCalculated = now;
        } else if (accountAge >= 7 && user.rewardHistory.accountAge.totalAwarded < REWARDS.ACCOUNT_AGE.ONE_WEEK) {
            user.tokens += REWARDS.ACCOUNT_AGE.ONE_WEEK;
            user.rewardHistory.accountAge.totalAwarded = REWARDS.ACCOUNT_AGE.ONE_WEEK;
            user.rewardHistory.accountAge.lastCalculated = now;
        }
    } catch (error) {
        console.error('Error calculating account age rewards:', error);
    }

    // Check premium rewards
    try {
        if (user.isPremium &&
            (!user.rewardHistory.premium.lastCalculated ||
                Math.floor((now.getTime() - user.rewardHistory.premium.lastCalculated.getTime()) / (1000 * 3600 * 24)) >= 30)) {
            user.tokens += REWARDS.PREMIUM_USER;
            user.rewardHistory.premium.totalAwarded += REWARDS.PREMIUM_USER;
            user.rewardHistory.premium.lastCalculated = now;
        }
    } catch (error) {
        console.error('Error calculating premium rewards:', error);
    }

    user.lastVisit = now;
    await user.save();
    console.log('User saved successfully');

    return user;
};

export const getUserRank = async (telegramId: number): Promise<number> => {
    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            throw new Error('User not found');
        }

        // Count how many users have more tokens
        const higherRanked = await User.countDocuments({
            tokens: { $gt: user.tokens }
        });

        // Rank is the number of users with more tokens + 1
        return higherRanked + 1;
    } catch (error) {
        console.error('Error in getUserRank:', error);
        throw error;
    }
};

export const getUserWithFriends = async (telegramId: number): Promise<FriendsResponse> => {
    try {
        // Get user without updating streaks/rewards
        const user = await User.findOne({ telegramId });
        if (!user) {
            throw new Error('User not found');
        }

        // Get user's rank
        const rank = await getUserRank(telegramId);

        // Find all friends (users who used this user's referral code)
        const friends = await User.find({
            referredByCode: user.referralCode
        }).select('username firstName lastName tokens');

        return {
            user: {
                username: user.username,
                balance: user.tokens,
                rank: rank.toString(),
                referralCode: user.referralCode,
                initials: getInitials(user.firstName, user.lastName)
            },
            friends: friends.map(friend => ({
                username: friend.username,
                balance: friend.tokens,
                initials: getInitials(friend.firstName, friend.lastName)
            }))
        };
    } catch (error) {
        console.error('Error in getUserWithFriends:', error);
        throw error;
    }
};

export const getInitials = (firstName: string = '', lastName: string = ''): string => {
    const firstInitial = firstName.charAt(0).toUpperCase();
    const lastInitial = lastName.charAt(0).toUpperCase();
    //todo : add username initials in case of not having firstName and LastName

    if (firstInitial && lastInitial) {
        return `${firstInitial}${lastInitial}`;
    } else if (firstInitial) {
        return firstInitial + firstInitial;
    } else {
        return 'NA';
    }
}