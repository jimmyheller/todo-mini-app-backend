import redisClient from '../config/redis';
import User from '../models/User';
import {getInitials} from "./userService";

const LEADERBOARD_KEY = 'leaderboard';
const LEADERBOARD_TTL = 3600; // 1 hour in seconds
const MAX_LEADERBOARD_SIZE = 500; // Maximum number of users in leaderboard
interface LeaderboardCache {
  leaderboard: any[];
  totalUsers: number;
}

export const getLeaderboard = async (limit: number, offset: number) => {
  try {
    const cachedData = await redisClient.get(LEADERBOARD_KEY);

    if (cachedData) {
      console.log('Returning cached leaderboard');
      const { leaderboard, totalUsers } = JSON.parse(cachedData) as LeaderboardCache;
      return {
        leaderboard: leaderboard.slice(offset, offset + limit),
        total: totalUsers,
      };
    }

    console.log('Fetching leaderboard from database');

    // Get total count of non-hidden users
    const totalUsers = await User.countDocuments({
      $or: [
        { hidden: false },
        { hidden: { $exists: false } }
      ]
    });

    // Get top 500 users for leaderboard
    const users = await User.find({
      $or: [
        { hidden: false },
        { hidden: { $exists: false } }
      ]
    })
    .sort({ tokens: -1 })
    .limit(MAX_LEADERBOARD_SIZE)
    .lean();
    
    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      id: user._id,
      name: user.username,
      tokens: user.tokens,
      streaks: user.currentStreak,
      initials: getInitials(user.username),
      profilePhoto: user.profilePhoto ? {
        smallFileUrl: user.profilePhoto.smallFileUrl,
        largeFileUrl: user.profilePhoto.largeFileUrl
      } : undefined
    }));

    // Cache both leaderboard and total users count
    const cacheData: LeaderboardCache = {
      leaderboard,
      totalUsers
    };
    await redisClient.setEx(LEADERBOARD_KEY, LEADERBOARD_TTL, JSON.stringify(cacheData));

    return {
      leaderboard: leaderboard.slice(offset, offset + limit),
      total: totalUsers,
    };
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    throw error;
  }
};