import redisClient from '../config/redis';
import User from '../models/User';

const LEADERBOARD_KEY = 'leaderboard';
const LEADERBOARD_TTL = 3600; // 1 hour in seconds

export const getLeaderboard = async (limit: number, offset: number) => {
  try {
    const cachedLeaderboard = await redisClient.get(LEADERBOARD_KEY);

    if (cachedLeaderboard) {
      console.log('Returning cached leaderboard');
      const leaderboard = JSON.parse(cachedLeaderboard);
      return {
        leaderboard: leaderboard.slice(offset, offset + limit),
        total: leaderboard.length,
      };
    }

    console.log('Fetching leaderboard from database');
    const users = await User.find().sort({ tokens: -1 }).lean();
    
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      id: user._id,
      name: user.username,
      tokens: user.tokens,
      streaks: user.currentStreak,
    }));

    await redisClient.setEx(LEADERBOARD_KEY, LEADERBOARD_TTL, JSON.stringify(leaderboard));

    return {
      leaderboard: leaderboard.slice(offset, offset + limit),
      total: leaderboard.length,
    };
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    throw error; // Re-throw the error to be caught in the route handler
  }
};

export const updateLeaderboard = async (userId: string) => {
  try {
    await redisClient.del(LEADERBOARD_KEY);
    console.log('Leaderboard cache cleared');
  } catch (error) {
    console.error('Error in updateLeaderboard:', error);
    throw error;
  }
};