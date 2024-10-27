import { createOrFetchUser, awardWelcomeToken, checkAndUpdateDailyStreak } from '../userService';
import { generateReferralCode } from '../../utils/referralCode';
import User from '../../models/User';
import * as dbHandler from '../../test-utils/db-handler';

jest.mock('../../utils/referralCode', () => ({
    generateReferralCode: jest.fn().mockReturnValue('ABCD1234')
}));

describe('UserService', () => {
    beforeAll(async () => {
        await dbHandler.connect();
    });

    afterAll(async () => {
        await dbHandler.closeDatabase();
    });

    beforeEach(async () => {
        await dbHandler.clearDatabase();
        jest.clearAllMocks();
        // Reset to real timers before each test
        jest.useRealTimers();
    });

    const mockTelegramData = {
        id: 12345,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        is_premium: false
    };

    describe('createOrFetchUser', () => {
        it('should create a new user when user does not exist', async () => {
            const user = await createOrFetchUser(mockTelegramData);

            expect(user.telegramId).toBe(mockTelegramData.id);
            expect(user.username).toBe(mockTelegramData.username);
            expect(user.firstName).toBe(mockTelegramData.first_name);
            expect(user.lastName).toBe(mockTelegramData.last_name);
            expect(user.isPremium).toBe(false);
            expect(user.tokens).toBe(0);
            expect(user.currentStreak).toBe(0);
            expect(user.referralCode).toBe('ABCD1234');
        });

        it('should return existing user when user exists', async () => {
            const existingUser = await User.create({
                telegramId: mockTelegramData.id,
                username: mockTelegramData.username,
                firstName: mockTelegramData.first_name,
                lastName: mockTelegramData.last_name,
                referralCode: 'EXISTING123'
            });

            const user = await createOrFetchUser(mockTelegramData);
            expect(user.telegramId).toBe(existingUser.telegramId);
            expect(user.referralCode).toBe('EXISTING123');
        });
    });

    describe('awardWelcomeToken', () => {
        it('should award welcome tokens to new user', async () => {
            await User.create({
                telegramId: 12345,
                username: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                tokens: 0,
                referralCode: 'TEST1234'
            });

            const updatedUser = await awardWelcomeToken(12345);
            expect(updatedUser.tokens).toBe(500);
            expect(updatedUser.currentStreak).toBe(1);
        });

        it('should not award welcome tokens if user already has tokens', async () => {
            await User.create({
                telegramId: 12345,
                username: 'testuser',
                firstName: 'Test',
                lastName: 'User',
                tokens: 100,
                referralCode: 'TEST1234'
            });

            const updatedUser = await awardWelcomeToken(12345);
            expect(updatedUser.tokens).toBe(100);
        });

        it('should throw error for non-existent user', async () => {
            await expect(awardWelcomeToken(99999)).rejects.toThrow('User not found');
        });
    });

    describe('checkAndUpdateDailyStreak', () => {
        const createUserWithStreak = async (lastVisit: Date, currentStreak: number = 1, tokens: number = 0) => {
            return await User.create({
                telegramId: 12345,
                username: 'testuser',
                firstName: 'Test',
                referralCode: 'TEST1234',
                currentStreak,
                tokens,
                lastVisit
            });
        };

        it('should increment streak for visits on consecutive calendar days', async () => {
            // Set up a fixed current time
            const now = new Date('2024-01-02T10:00:00Z'); // January 2nd, 2024 at 10 AM UTC
            const yesterday = new Date('2024-01-01T22:00:00Z'); // January 1st, 2024 at 10 PM UTC

            jest.useFakeTimers();
            jest.setSystemTime(now);

            await createUserWithStreak(yesterday, 1, 100);
            const updatedUser = await checkAndUpdateDailyStreak(12345);

            expect(updatedUser.currentStreak).toBe(2);
            expect(updatedUser.tokens).toBe(200); // 100 initial + 100 for streak

            jest.useRealTimers();
        });

        it('should handle same-day visits without updating streak', async () => {
            const now = new Date('2024-01-01T16:00:00Z'); // 4 PM UTC
            const earlierToday = new Date('2024-01-01T08:00:00Z'); // 8 AM UTC same day

            jest.useFakeTimers();
            jest.setSystemTime(now);

            await createUserWithStreak(earlierToday, 3, 300);
            const updatedUser = await checkAndUpdateDailyStreak(12345);

            expect(updatedUser.currentStreak).toBe(3); // Should remain unchanged
            expect(updatedUser.tokens).toBe(300); // Should remain unchanged

            jest.useRealTimers();
        });

        it('should reset streak after missing days', async () => {
            const now = new Date('2024-01-03T10:00:00Z'); // January 3rd
            const twoDaysAgo = new Date('2024-01-01T10:00:00Z'); // January 1st

            jest.useFakeTimers();
            jest.setSystemTime(now);

            await createUserWithStreak(twoDaysAgo, 5, 500);
            const updatedUser = await checkAndUpdateDailyStreak(12345);

            expect(updatedUser.currentStreak).toBe(1);
            expect(updatedUser.tokens).toBe(600);

            jest.useRealTimers();
        });

        it('should handle month boundary correctly', async () => {
            const now = new Date('2024-02-01T00:00:00Z'); // February 1st
            const lastDayOfJan = new Date('2024-01-31T23:59:59Z'); // January 31st

            jest.useFakeTimers();
            jest.setSystemTime(now);

            await createUserWithStreak(lastDayOfJan, 1, 100);
            const updatedUser = await checkAndUpdateDailyStreak(12345);

            expect(updatedUser.currentStreak).toBe(2);
            expect(updatedUser.tokens).toBe(200);

            jest.useRealTimers();
        });

        it('should handle year boundary correctly', async () => {
            const now = new Date('2024-01-01T00:00:00Z'); // January 1st, 2024
            const lastDayOfYear = new Date('2023-12-31T23:59:59Z'); // December 31st, 2023

            jest.useFakeTimers();
            jest.setSystemTime(now);

            await createUserWithStreak(lastDayOfYear, 1, 100);
            const updatedUser = await checkAndUpdateDailyStreak(12345);

            expect(updatedUser.currentStreak).toBe(2);
            expect(updatedUser.tokens).toBe(200);

            jest.useRealTimers();
        });
    });
});