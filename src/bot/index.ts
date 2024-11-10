// src/bot/index.ts
import { Telegraf, Context } from 'telegraf';
import User, { IUser } from '../models/User';
import { generateReferralCode } from '../utils/referralCode';
import express from 'express';

interface BotContext extends Context {
    user?: IUser;
}

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);

// Constants
const REFERRAL_REWARD = 1000;
const MINI_APP_URL = `https://t.me/${process.env.BOT_USERNAME}/app`;

// Message templates
const messages = {
    welcomeNew: '🎉 Welcome to Robota!\n\nStart earning $TODO tokens by using our mini app.',
    welcomeNewReferred: '🎉 Welcome to Robota!\n\nYou\'ve been invited by a friend! Start earning $TODO tokens by using our mini app.',
    alreadyRegistered: '👋 Welcome back!\n\nYou already have an account with us.',
    error: 'Sorry, something went wrong. Please try again later.'
};

// Helper function to create a new user
async function createNewUser(telegramId: number, userData: any, referralCode?: string): Promise<IUser> {
    const user = new User({
        telegramId,
        username: userData.username || '',
        firstName: userData.first_name,
        lastName: userData.last_name || '',
        referralCode: generateReferralCode(),
        referredByCode: referralCode,
        isPremium: Boolean(userData.is_premium),
        lastVisit: new Date(),
        rewardHistory: {
            accountAge: { lastCalculated: new Date(), totalAwarded: 0 },
            premium: { lastCalculated: new Date(), totalAwarded: 0 },
            dailyCheckin: { lastCalculated: new Date(), totalAwarded: 0 },
            referrals: { lastCalculated: new Date(), totalAwarded: 0 }
        }
    });

    await user.save();
    console.log('New user created:', { telegramId, referralCode: user.referralCode });
    return user;
}

// Helper function to process referral reward
async function processReferralReward(referralCode: string): Promise<void> {
    const referrer = await User.findOne({ referralCode });
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

        console.log('Referral reward processed:', {
            referrerId: referrer.telegramId,
            reward: REFERRAL_REWARD,
            totalReferralRewards: referrer.rewardHistory.referrals.totalAwarded
        });
    }
}

// Helper function to send mini app link
async function sendMiniAppLink(ctx: BotContext, message: string): Promise<void> {
    await ctx.reply(message, {
        reply_markup: {
            inline_keyboard: [[
                { text: "Open Mini App", url: MINI_APP_URL }
            ]]
        }
    });
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

        console.log('Processing start command:', { telegramId, referralCode });

        // Check if user exists
        const existingUser = await User.findOne({ telegramId });

        if (existingUser) {
            // Case C: Existing User (with or without referral)
            console.log('Existing user found:', telegramId);
            await sendMiniAppLink(ctx, messages.alreadyRegistered);
        } else {
            if (referralCode) {
                // Case B: New User with referral
                console.log('Creating new user with referral:', { telegramId, referralCode });
                await createNewUser(telegramId, ctx.from, referralCode);
                await processReferralReward(referralCode);
                await sendMiniAppLink(ctx, messages.welcomeNewReferred);
            } else {
                // Case A: New User without referral
                console.log('Creating new user without referral:', telegramId);
                await createNewUser(telegramId, ctx.from);
                await sendMiniAppLink(ctx, messages.welcomeNew);
            }
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
            { command: 'start', description: 'Start the bot and join Robota' },
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