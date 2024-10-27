import { createOrFetchUser, awardWelcomeToken, checkAndUpdateDailyStreak } from '../userService';
import { generateReferralCode } from '../../utils/referralCode';
import User from '../../models/User';
import * as dbHandler from '../../test-utils/db-handler';

jest.mock('../../utils/referralCode', () => ({
    generateReferralCode: jest.fn().mockReturnValue('ABCD1234')
}));

describe('UserService', () => {
    const mockTelegramData = {
        id: 12345,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        is_premium: false
    };

    beforeAll(async () => {
        await dbHandler.connect();
    });

    afterAll(async () => {
        await dbHandler.closeDatabase();
    });

    beforeEach(async () => {
        await dbHandler.clearDatabase();
        jest.clearAllMocks();
    });

    describe('createOrFetchUser', () => {
        it('should create a new user when user does not exist', async () => {
            const user = await createOrFetchUser(mockTelegramData);
            expect(user.telegramId).toBe(mockTelegramData.id);
            expect(user.username).toBe(mockTelegramData.username);
            expect(user.firstName).toBe(mockTelegramData.first_name);
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

        it('should increment streak for consecutive days', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await createUserWithStreak(yesterday, 1, 100);
            const updatedUser = await checkAndUpdateDailyStreak(12345);

            expect(updatedUser.currentStreak).toBe(2);
            expect(updatedUser.tokens).toBe(200);
        });

        it('should not update for same day visits', async () => {
            const today = new Date();
            await createUserWithStreak(today, 3, 300);

            const updatedUser = await checkAndUpdateDailyStreak(12345);
            expect(updatedUser.currentStreak).toBe(3);
            expect(updatedUser.tokens).toBe(300);
        });

        it('should reset streak after missing a day', async () => {
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            await createUserWithStreak(twoDaysAgo, 5, 500);
            const updatedUser = await checkAndUpdateDailyStreak(12345);

            expect(updatedUser.currentStreak).toBe(1);
            expect(updatedUser.tokens).toBe(600);
        });
    });
});