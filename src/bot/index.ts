// src/bot/index.ts
import {Telegraf, Context} from 'telegraf';
import User, {IUser} from '../models/User';
import {generateReferralCode} from '../utils/referralCode';
import express from 'express';
import path from 'path';

interface BotContext extends Context {
    user?: IUser;
}

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);

// Constants
const REFERRAL_REWARD = 500;
const MINI_APP_URL = `https://todomanytask.vercel.app`;
const WELCOME_GIF_PATH = path.join(__dirname, '..', '..', 'assets', 'welcome.mp4');

// Message templates
const messages = {
    welcome: 'Let\'s get started ✅\n' +
        '\n' +
        'Tap the button "TODO" below to start your first task and earn rewards!\n' +
        '\n' +
        '👇',
    error: 'Sorry, something went wrong. Please try again later.'
};

// Helper function to create a new user
async function createNewUser(telegramId: number, userData: any, referralCode?: string): Promise<IUser> {
    const now = new Date();
    const user = new User({
        telegramId,
        username: userData.username || '',
        firstName: userData.first_name,
        lastName: userData.last_name || '',
        isPremium: Boolean(userData.is_premium),
        isBot: Boolean(userData.is_bot),
        isFake: Boolean(userData.is_fake),
        isScam: Boolean(userData.is_scam),
        referralCode: generateReferralCode(),
        referredByCode: referralCode,
        createdAt: now,
        lastVisit: now,
        rewardHistory: {
            dailyCheckin: {lastCalculated: new Date(), totalAwarded: 0},
            referrals: {lastCalculated: new Date(), totalAwarded: 0}
        }
    });

    await user.save();
    console.debug('New user created:', {telegramId, referralCode: user.referralCode});
    return user;
}

// Helper function to process referral reward
async function processReferralReward(referralCode: string): Promise<void> {
    const referrer = await User.findOne({referralCode});
    if (referrer) {
        console.log('Processing referral reward for:', referrer.telegramId);

        if (!referrer.rewardHistory.referrals) {
            referrer.rewardHistory.referrals = {
                lastCalculated: new Date(),
                totalAwarded: 0
            };
        }

        referrer.rewardHistory.referrals.totalAwarded += REFERRAL_REWARD;
        referrer.tokens = (referrer.tokens || 0) + REFERRAL_REWARD;
        await referrer.save();

        console.debug('Referral reward processed:', {
            referrerId: referrer.telegramId,
            reward: REFERRAL_REWARD,
            totalReferralRewards: referrer.rewardHistory.referrals.totalAwarded
        });
    }
}

// Helper function to send welcome message with GIF
async function sendWelcomeMessage(ctx: BotContext, message: string): Promise<void> {
    try {
        // First send the animation
        await ctx.replyWithAnimation({ source: WELCOME_GIF_PATH });
        // Then send the welcome message
        await ctx.reply(message);
    } catch (error) {
        console.error('Error sending welcome message:', error);
        await ctx.reply(messages.error);
    }
}

async function processUserProfilePhoto(ctx: BotContext, userId: number): Promise<any> {
    try {
        const photos = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);

        if (photos && photos.total_count > 0) {
            const photo = photos.photos[0]; // Get the most recent photo

            // Get small and large size photos
            const smallPhoto = photo[0]; // 160x160
            const largePhoto = photo[photo.length - 1]; // largest available size

            // Get file paths
            const smallFilePath = await ctx.telegram.getFile(smallPhoto.file_id);
            const largeFilePath = await ctx.telegram.getFile(largePhoto.file_id);

            // Construct URLs (Telegram Bot API file URLs)
            const baseUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}`;
            const smallFileUrl = `${baseUrl}/${smallFilePath.file_path}`;
            const largeFileUrl = `${baseUrl}/${largeFilePath.file_path}`;

            return {
                smallFileId: smallPhoto.file_id,
                largeFileId: largePhoto.file_id,
                smallFileUrl,
                largeFileUrl,
                lastUpdated: new Date()
            };
        }
        return null;
    } catch (error) {
        console.error('Error processing profile photo:', error);
        return null;
    }
}

// Main bot command handler
bot.command('start', async (ctx) => {
    console.log('Start command received');

    try {
        if (!ctx.message || !ctx.from?.id) {
            console.log('Invalid context or missing user data');
            await ctx.reply(messages.error);
            return;
        }

        const telegramId = ctx.from.id;
        const referralCode = ctx.message.text.split(' ')[1];

        // Check if user exists -> todo : should be removed when we moved to production
        let existingUser = await User.findOne({telegramId});

        if (existingUser) {
            // Update existing user's profile photo
            const profilePhoto = await processUserProfilePhoto(ctx, telegramId);
            if (profilePhoto) {
                existingUser.profilePhoto = profilePhoto;
                await existingUser.save();
            }

            await sendWelcomeMessage(ctx, messages.welcome);
        } else {
            // Create new user and process profile photo
            const user = await createNewUser(telegramId, ctx.from, referralCode);
            const profilePhoto = await processUserProfilePhoto(ctx, telegramId);

            if (profilePhoto) {
                user.profilePhoto = profilePhoto;
                await user.save();
            }

            if (referralCode) {
                await processReferralReward(referralCode);
            }
            await sendWelcomeMessage(ctx, messages.welcome);
        }

    } catch (error) {
        console.error('Error in start command:', error);
        await ctx.reply(messages.error);
    }
});

// Bot initialization remains the same...
export const initBot = async (app: express.Application): Promise<void> => {
    try {
        console.log('Initializing bot...');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('WEBHOOK_DOMAIN:', process.env.WEBHOOK_DOMAIN);

        if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_DOMAIN) {
            const secretPath = `/webhook-${bot.secretPathComponent()}`;
            const webhookUrl = process.env.WEBHOOK_DOMAIN.startsWith('https://')
                ? `${process.env.WEBHOOK_DOMAIN}${secretPath}`
                : `https://${process.env.WEBHOOK_DOMAIN}${secretPath}`;

            console.log('Setting webhook to:', webhookUrl);

            await bot.telegram.deleteWebhook();
            await bot.telegram.setWebhook(webhookUrl);

            app.use(secretPath, express.json(), (req, res) => {
                console.log('Received webhook request:', {
                    method: req.method,
                    path: req.path,
                    body: req.body
                });
                bot.handleUpdate(req.body, res);
            });

            console.log('Webhook setup complete');
        } else {
            console.log('Starting bot in polling mode');
            await bot.launch();
            console.log('Bot launched in polling mode');
        }

        // Initialize bot commands
        await registerBotCommands();

    } catch (error) {
        console.error('Error initializing bot:', error);
        throw error;
    }
};

export const registerBotCommands = async (): Promise<void> => {
    try {
        console.log('Registering bot commands...');
        const commands = [
            {command: 'start', description: 'Start the bot and join Robota'},
            // Add more commands here as needed
        ];

        await bot.telegram.setMyCommands(commands);
        console.log('Bot commands registered successfully:', commands);
    } catch (error) {
        console.error('Error registering bot commands:', error);
        throw error;
    }
};

export const botInstance = bot;