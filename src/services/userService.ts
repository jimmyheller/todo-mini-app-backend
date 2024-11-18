// src/services/userService.ts
import User, {IUser} from '../models/User';
import {generateReferralCode} from '../utils/referralCode';

// Reward constants
const REWARDS = {
    WELCOME: 1000,
    REFERRAL: 500,
    STREAK: {
        BASE: 100,      // 1-6 days
        WEEK: 150,      // 7-29 days
        MONTH: 200,     // 30-99 days
        CENTURY: 200    // 100+ days
    }
};

interface FriendsResponse {
    user: {
        username: string;
        balance: number;
        rank: string;
        referralCode: string;
        initials: string;
        profilePhoto?: {
            smallFileUrl?: string;
            largeFileUrl?: string;
        };
    };
    friends: Array<{
        username: string;
        balance: number;
        initials: string;
        profilePhoto?: {
            smallFileUrl?: string;
            largeFileUrl?: string;
        };
    }>;
}

interface DailyStreakResponse {
    rewardAmount: number;
    currentStreak: number;
}

const initializeRewardHistory = (date: Date) => ({
    dailyCheckin: {lastCalculated: date, totalAwarded: 0},
    referrals: {lastCalculated: date, totalAwarded: 0}
});

export async function createOrFetchUser(userData: any): Promise<IUser> {
    try {
        let user = await User.findOne({telegramId: userData.id});
        if (user) {
            return user;
        }

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
                user = await User.findOne({telegramId: userData.id});
                if (!user) {
                    throw new Error('Failed to create or fetch user');
                }
            } else {
                throw error;
            }
        }

        console.debug('New user created by mini app.', {
            telegramId: user.telegramId,
            referralCode: user.referralCode
        });
        return user;
    } catch (error: any) {
        console.error('Error in createOrFetchUser:', error);
        throw error;
    }
}

export const awardWelcomeToken = async (telegramId: number): Promise<IUser> => {
    const user = await User.findOne({telegramId});
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
    clientTimezoneOffset: number = 0
): Promise<DailyStreakResponse> => {
    const user = await User.findOne({telegramId});
    if (!user) {
        console.error(`Could not find any user by ${telegramId}`, telegramId);
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

    // Initialize reward history if needed
    if (!user.rewardHistory) {
        user.rewardHistory = initializeRewardHistory(now);
    }

    let rewardAmount = 0;

    // Handle streak updates and calculate rewards
    if (daysDifference === 1) {
        // Increment streak and calculate reward based on streak length
        user.currentStreak += 1;

        // Determine reward amount based on streak length
        if (user.currentStreak >= 100) {
            rewardAmount = REWARDS.STREAK.CENTURY;
        } else if (user.currentStreak >= 30) {
            rewardAmount = REWARDS.STREAK.MONTH;
        } else if (user.currentStreak >= 7) {
            rewardAmount = REWARDS.STREAK.WEEK;
        } else {
            rewardAmount = REWARDS.STREAK.BASE;
        }
    } else if (daysDifference > 1) {
        // Reset streak if more than one day has passed
        user.currentStreak = 1;
        rewardAmount = REWARDS.STREAK.BASE;
    }

    // Update rewards if applicable
    if (rewardAmount > 0) {
        user.tokens += rewardAmount;

        // Update reward history
        if (!user.rewardHistory.dailyCheckin) {
            user.rewardHistory.dailyCheckin = {
                lastCalculated: now,
                totalAwarded: 0
            };
        }

        user.rewardHistory.dailyCheckin.totalAwarded += rewardAmount;
        user.rewardHistory.dailyCheckin.lastCalculated = now;
    }

    // Store the visit time in UTC
    user.lastVisit = now;
    await user.save();

    return {
        rewardAmount: rewardAmount,
        currentStreak: user.currentStreak
    };
};


export const getUserRank = async (telegramId: number): Promise<number> => {
    try {
        const user = await User.findOne({telegramId});
        if (!user) {
            throw new Error('User not found');
        }

        // Count how many users have more tokens
        const higherRanked = await User.countDocuments({
            tokens: {$gt: user.tokens}
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
        const user = await User.findOne({telegramId});
        if (!user) {
            throw new Error('User not found');
        }

        const rank = await getUserRank(telegramId);

        // Updated to include profile photo data and sort by createdAt
        const friends = await User.find({
            referredByCode: user.referralCode
        })
            .select('username firstName lastName tokens profilePhoto createdAt')
            .sort({ createdAt: -1 }); // -1 for descending order (newest first)

        return {
            user: {
                username: user.username,
                balance: user.tokens,
                rank: rank.toString(),
                referralCode: user.referralCode,
                initials: getInitials(user.username),
                profilePhoto: user.profilePhoto ? {
                    smallFileUrl: user.profilePhoto.smallFileUrl,
                    largeFileUrl: user.profilePhoto.largeFileUrl
                } : undefined
            },
            friends: friends.map(friend => ({
                username: friend.username,
                balance: friend.tokens,
                initials: getInitials(friend.username),
                profilePhoto: friend.profilePhoto ? {
                    smallFileUrl: friend.profilePhoto.smallFileUrl,
                    largeFileUrl: friend.profilePhoto.largeFileUrl
                } : undefined
            }))
        };
    } catch (error) {
        console.error('Error in getUserWithFriends:', error);
        throw error;
    }
};

export const getInitials = (userName: string): string => {
    return userName.charAt(0).toUpperCase() + userName.charAt(1).toUpperCase();
}