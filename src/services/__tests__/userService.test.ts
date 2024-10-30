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
            expect(user.rewardHistory).toBeDefined();
            expect(user.rewardHistory.accountAge).toBeDefined();
            expect(user.rewardHistory.premium).toBeDefined();
            expect(user.rewardHistory.dailyCheckin).toBeDefined();
        });

        it('should create premium user with correct status', async () => {
            const premiumUserData = { ...mockTelegramData, is_premium: true };
            const user = await createOrFetchUser(premiumUserData);
            expect(user.isPremium).toBe(true);
        });

        it('should return existing user when user exists', async () => {
            const existingUser = await User.create({
                telegramId: mockTelegramData.id,
                username: mockTelegramData.username,
                firstName: mockTelegramData.first_name,
                lastName: mockTelegramData.last_name,
                referralCode: 'EXISTING123',
                rewardHistory: {
                    accountAge: { lastCalculated: new Date(), totalAwarded: 0 },
                    premium: { lastCalculated: new Date(), totalAwarded: 0 },
                    dailyCheckin: { lastCalculated: new Date(), totalAwarded: 0 }
                }
            });

            const user = await createOrFetchUser(mockTelegramData);
            expect(user.telegramId).toBe(existingUser.telegramId);
        });
    });

    describe('checkAndUpdateDailyStreak', () => {
        const createUserWithStreak = async (lastVisit: Date, currentStreak: number = 1, tokens: number = 0, options: any = {}) => {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            return await User.create({
                telegramId: 12345,
                username: 'testuser',
                firstName: 'Test',
                referralCode: 'TEST1234',
                currentStreak,
                tokens,
                lastVisit,
                isPremium: options.isPremium || false,
                createdAt: options.createdAt || sevenDaysAgo,
                rewardHistory: {
                    accountAge: { lastCalculated: options.lastAccountAgeCheck || new Date(), totalAwarded: options.accountAgeRewards || 0 },
                    premium: { lastCalculated: options.lastPremiumCheck || new Date(), totalAwarded: options.premiumRewards || 0 },
                    dailyCheckin: { lastCalculated: lastVisit, totalAwarded: currentStreak * 100 }
                }
            });
        };

        it('should increment streak for consecutive days', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            await createUserWithStreak(yesterday, 1, 100);
            const updatedUser = await checkAndUpdateDailyStreak(12345);

            expect(updatedUser.currentStreak).toBe(2);
            expect(updatedUser.tokens).toBe(200);
            expect(updatedUser.rewardHistory.dailyCheckin.totalAwarded).toBe(200);
        });

        it('should not update for same day visits', async () => {
            const today = new Date();
            await createUserWithStreak(today, 3, 300);

            const updatedUser = await checkAndUpdateDailyStreak(12345);
            expect(updatedUser.currentStreak).toBe(3);
            expect(updatedUser.tokens).toBe(300);
            expect(updatedUser.rewardHistory.dailyCheckin.totalAwarded).toBe(300);
        });

        it('should reset streak after missing a day', async () => {
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            await createUserWithStreak(twoDaysAgo, 5, 500);
            const updatedUser = await checkAndUpdateDailyStreak(12345);

            expect(updatedUser.currentStreak).toBe(1);
            expect(updatedUser.tokens).toBe(600);
            expect(updatedUser.rewardHistory.dailyCheckin.totalAwarded).toBe(600);
        });

        it('should award one week account age reward', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            await createUserWithStreak(yesterday, 1, 100, {
                createdAt: sevenDaysAgo,
                accountAgeRewards: 0
            });

            const updatedUser = await checkAndUpdateDailyStreak(12345);
            expect(updatedUser.tokens).toBe(1200); // 100 initial + 100 streak + 1000 week reward
            expect(updatedUser.rewardHistory.accountAge.totalAwarded).toBe(1000);
        });

        it('should award one month account age reward', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            await createUserWithStreak(yesterday, 1, 100, {
                createdAt: thirtyDaysAgo,
                accountAgeRewards: 0
            });

            const updatedUser = await checkAndUpdateDailyStreak(12345);
            expect(updatedUser.tokens).toBe(4200); // 100 initial + 100 streak + 4000 month reward
            expect(updatedUser.rewardHistory.accountAge.totalAwarded).toBe(4000);
        });

        it('should award premium rewards monthly', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const thirtyOneDaysAgo = new Date();
            thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

            await createUserWithStreak(yesterday, 1, 100, {
                isPremium: true,
                lastPremiumCheck: thirtyOneDaysAgo
            });

            const updatedUser = await checkAndUpdateDailyStreak(12345);
            expect(updatedUser.tokens).toBe(1200); // 100 initial + 100 streak + 1000 premium reward
            expect(updatedUser.rewardHistory.premium.totalAwarded).toBe(1000);
        });

        it('should not award premium rewards before monthly interval', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const twentyNineDaysAgo = new Date();
            twentyNineDaysAgo.setDate(twentyNineDaysAgo.getDate() - 29);

            await createUserWithStreak(yesterday, 1, 100, {
                isPremium: true,
                lastPremiumCheck: twentyNineDaysAgo
            });

            const updatedUser = await checkAndUpdateDailyStreak(12345);
            expect(updatedUser.tokens).toBe(200); // 100 initial + 100 streak
            expect(updatedUser.rewardHistory.premium.totalAwarded).toBe(0);
        });
    });
});