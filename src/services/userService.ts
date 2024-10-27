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
    console.log('awarding the tokens')
    if (user.tokens === 0) {
        user.tokens = 500; // Award 500 tokens for first-time users
        user.currentStreak = 1; //initiating their streak 
        console.log('awarding the tokens with user', user);
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
    const lastVisit = new Date(user.lastVisit);

    // Convert both dates to their respective midnight timestamps for calendar day comparison
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastVisitDate = new Date(lastVisit.getFullYear(), lastVisit.getMonth(), lastVisit.getDate());

    // Calculate difference in calendar days
    const daysDifference = Math.floor((nowDate.getTime() - lastVisitDate.getTime()) / (1000 * 3600 * 24));

    console.log('Current date (midnight):', nowDate);
    console.log('Last visit date (midnight):', lastVisitDate);
    console.log('Days difference:', daysDifference);
    console.log('Before update - Streak:', user.currentStreak, 'Tokens:', user.tokens);

    if (daysDifference === 0) {
        // Same calendar day - no changes
        console.log('Same day visit - no streak update');
    } else if (daysDifference === 1) {
        // Consecutive calendar day
        user.currentStreak += 1;
        user.tokens += 100;
        console.log('Consecutive day - incrementing streak');
    } else {
        // More than one day gap
        user.currentStreak = 1;
        user.tokens += 100;
        console.log('Streak reset - more than one day gap');
    }

    user.lastVisit = now;
    await user.save();

    console.log('After update - Streak:', user.currentStreak, 'Tokens:', user.tokens);
    return user;
};