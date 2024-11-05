//src/utils/redisHelper.ts
import redisClient from '../config/redis';

const STREAK_SHOWN_PREFIX = 'streak:shown';

export const getStreakKey = (userId: string) => {
    const today = new Date();
    const dateKey = today.toISOString().split('T')[0].replace(/-/g, '');
    return `${STREAK_SHOWN_PREFIX}:${userId}:${dateKey}`;
};

export const checkStreakShown = async (userId: string): Promise<boolean> => {
    const key = getStreakKey(userId);
    const shown = await redisClient.get(key);
    return shown === 'true';
};

export const markStreakShown = async (userId: string): Promise<void> => {
    const key = getStreakKey(userId);
    // Set with expiry at the end of current day (in seconds)
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const ttlSeconds = Math.ceil((endOfDay.getTime() - now.getTime()) / 1000);

    await redisClient.setEx(key, ttlSeconds, 'true');
};