import User, { IUser } from '../models/User';
import { generateReferralCode } from '../utils/referralCode';

export async function createOrFetchUser(userData: any): Promise<IUser> {
    try {
        let user = await User.findOne({ telegramId: userData.id });
        console.log('createOrFetchUser userData', userData);
        if (!user) {
            try {
                user = new User({
                    telegramId: userData.id,
                    username: userData.username,
                    firstName: userData.first_name,
                    lastName: userData.last_name,
                    isPremium: userData.is_premium || false,
                    referralCode: generateReferralCode(),
                });
                await user.save();
            } catch (error: any) {
                if (error.code === 11000) {
                    // If duplicate key error, fetch the existing user
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
        user.tokens = 500; // Award 500 tokens for first-time users
        user.currentStreak = 1; //initiating their streak 
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
    const lastVisit = user.lastVisit;
    const daysSinceLastVisit = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 3600 * 24));

    if (daysSinceLastVisit === 1) {
        user.currentStreak += 1;
        user.tokens += 100; // Award 100 tokens for maintaining the streak
    } else if (daysSinceLastVisit > 1) {
        user.currentStreak = 1;
        user.tokens += 50; // Award 50 tokens for starting a new streak
    }

    user.lastVisit = now;
    await user.save();

    return user;
};