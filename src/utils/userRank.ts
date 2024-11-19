import User from "../models/User";

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
