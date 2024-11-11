// src/services/userService.ts
import User, { IUser } from '../models/User';
import { generateReferralCode } from '../utils/referralCode';

// Reward constants
const REWARDS = {
    WELCOME: 1000,
    DAILY_STREAK: 100
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
    user.tokens = REWARDS.WELCOME;
    return user;
};

export const checkAndUpdateDailyStreak = async (
    telegramId: number,
    clientTimezoneOffset: number = 0 // Default to UTC if not provided
): Promise<IUser> => {
    console.log('Starting checkAndUpdateDailyStreak for telegramId:', telegramId);
    console.log('Client timezone offset:', clientTimezoneOffset);

    const user = await User.findOne({ telegramId });
    if (!user) {
        throw new Error('User not found');
    }

    const now = new Date();
    const lastVisit = new Date(user.lastVisit);

    // Convert dates to client's local midnight
    const nowInClientTZ = new Date(now.getTime() + clientTimezoneOffset * 60000);
    const lastVisitInClientTZ = new Date(lastVisit.getTime() + clientTimezoneOffset * 60000);

    const clientNowDate = new Date(
        nowInClientTZ.getFullYear(),
        nowInClientTZ.getMonth(),
        nowInClientTZ.getDate()
    );

    const clientLastVisitDate = new Date(
        lastVisitInClientTZ.getFullYear(),
        lastVisitInClientTZ.getMonth(),
        lastVisitInClientTZ.getDate()
    );

    const daysDifference = Math.floor(
        (clientNowDate.getTime() - clientLastVisitDate.getTime()) / (1000 * 3600 * 24)
    );

    console.log('Days difference in client timezone:', daysDifference);

    // Initialize reward history if needed
    if (!user.rewardHistory) {
        user.rewardHistory = initializeRewardHistory(now);
    }

    let rewardAmount = 0;

    if (daysDifference === 1) {
        user.currentStreak += 1;
        rewardAmount = REWARDS.DAILY_STREAK;
    } else if (daysDifference > 1) {
        user.currentStreak = 1;
        rewardAmount = REWARDS.DAILY_STREAK;
    }

    // Rest of the reward calculation logic remains the same...

    // Store the visit time in UTC
    user.lastVisit = now;
    await user.save();

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