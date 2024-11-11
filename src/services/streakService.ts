// src/services/streakService.ts
import User, { IUser } from '../models/User';
import { checkAndUpdateDailyStreak } from './userService';

interface StreakCheckResponse {
    shouldShowCelebration: boolean;
    userData: IUser | null;
    isFirstTime: boolean;
}

interface TimezonedDate {
    date: Date;
    offsetMinutes: number;
}

function getDateInTimezone(date: Date, offsetMinutes: number): Date {
    // Convert UTC date to client's local time
    const clientDate = new Date(date.getTime() + offsetMinutes * 60000);

    // Get the date portion only in client's timezone
    return new Date(
        clientDate.getFullYear(),
        clientDate.getMonth(),
        clientDate.getDate()
    );
}

function getDaysDifference(date1: TimezonedDate, date2: TimezonedDate): number {
    const d1 = getDateInTimezone(date1.date, date1.offsetMinutes);
    const d2 = getDateInTimezone(date2.date, date2.offsetMinutes);

    // Calculate difference in days
    return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 3600 * 24));
}

export async function checkStreakStatus(
    telegramId: number,
    clientTimezoneOffset: number // Client's timezone offset in minutes
): Promise<StreakCheckResponse> {
    try {
        const user = await User.findOne({ telegramId });
        console.log('#checkStreakStatus: user -> ', user);
        if (!user) {
            return {
                shouldShowCelebration: true,
                userData: null,
                isFirstTime: true
            };
        }

        const now: TimezonedDate = {
            date: new Date(),
            offsetMinutes: clientTimezoneOffset
        };

        const lastVisit: TimezonedDate = {
            date: new Date(user.lastVisit),
            offsetMinutes: clientTimezoneOffset
        };

        const daysDifference = getDaysDifference(now, lastVisit);

        if (daysDifference === 0) {
            // Same day visit in user's timezone - no celebration needed
            return {
                shouldShowCelebration: false,
                userData: user,
                isFirstTime: false
            };
        }

        // Update streak and rewards, passing the timezone offset
        const updatedUser = await checkAndUpdateDailyStreak(telegramId, clientTimezoneOffset);
        console.log('#checkStreakStatus: updatedUser ->', updatedUser);
        return {
            shouldShowCelebration: true,
            userData: updatedUser,
            isFirstTime: daysDifference > 1
        };
    } catch (error) {
        console.error('Error in checkStreakStatus:', error);
        throw error;
    }
}