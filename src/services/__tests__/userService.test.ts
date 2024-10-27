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
        it('should increment streak for consecutive day visits', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await User.create({
                telegramId: 12345,
                username: 'testuser',
                firstName: 'Test',
                referralCode: 'TEST1234',
                currentStreak: 1,
                tokens: 0,
                lastVisit: yesterday
            });

            const updatedUser = await checkAndUpdateDailyStreak(12345);
            expect(updatedUser.currentStreak).toBe(2);
            expect(updatedUser.tokens).toBe(100);
        });
    });
});