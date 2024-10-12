import User, { IUser } from '../models/User';
import { generateReferralCode } from '../utils/referralCode';

export async function createOrFetchUser(userData: any) {
    try {
        let user = await User.findOne({ telegramId: userData.id });

        if (!user) {
            user = new User({
                telegramId: userData.id,
                username: userData.username,
                firstName: userData.first_name,
                lastName: userData.last_name,
                languageCode: userData.language_code,
                isPremium: userData.is_premium || false,
                referralCode: generateReferralCode(),
            });
            await user.save();
        }

        return user;
    } catch (error) {
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