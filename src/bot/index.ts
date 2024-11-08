// src/bot/index.ts
import { Telegraf, Context } from 'telegraf';
import User, { IUser } from '../models/User';
import { generateReferralCode } from '../utils/referralCode';
import express from 'express';
import { Message } from 'telegraf/typings/core/types/typegram';

// Define a custom context type that includes our user
interface BotContext extends Context {
    user?: IUser;
}

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);

// Handle /start command with referral code
bot.command('start', async (ctx) => {
    // Type guard for message context
    if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Sorry, unable to process your request.');
        return;
    }

    const referralCode = ctx.message.text.split(' ')[1]; // Get the second part after /start
    const telegramId = ctx.from?.id;

    if (!telegramId) {
        await ctx.reply('Sorry, unable to process your request.');
        return;
    }

    try {
        // Check if user already exists
        let user = await User.findOne({ telegramId });

        if (!user) {
            // Create new user
            user = new User({
                telegramId,
                username: ctx.from.username || '',
                firstName: ctx.from.first_name,
                lastName: ctx.from.last_name || '',
                referralCode: generateReferralCode(),
                referredByCode: referralCode, // Store who referred this user
                isPremium: Boolean(ctx.from.is_premium),
                lastVisit: new Date(),
                rewardHistory: {
                    accountAge: { lastCalculated: new Date(), totalAwarded: 0 },
                    premium: { lastCalculated: new Date(), totalAwarded: 0 },
                    dailyCheckin: { lastCalculated: new Date(), totalAwarded: 0 },
                    referrals: { lastCalculated: new Date(), totalAwarded: 0 }
                }
            });
            await user.save();

            // If there's a valid referral, update referrer's rewards
            if (referralCode) {
                const referrer = await User.findOne({ referralCode });
                if (referrer) {
                    // Initialize referrals if not exists
                    if (!referrer.rewardHistory.referrals) {
                        referrer.rewardHistory.referrals = {
                            lastCalculated: new Date(),
                            totalAwarded: 0
                        };
                    }
                    referrer.rewardHistory.referrals.totalAwarded += 1000;
                    referrer.tokens = (referrer.tokens || 0) + 1000;
                    await referrer.save();
                }
            }
        }

        // Send welcome message with mini app link
        const miniAppUrl = `https://t.me/${process.env.BOT_USERNAME}/app`;
        const message = referralCode
            ? `Welcome to Robota! 🎉\n\nYou've been invited by a friend! Start earning $TODO tokens by using our mini app.`
            : `Welcome to Robota! 🎉\n\nYou can start earning $TODO tokens by using our mini app.`;

        await ctx.reply(message, {
            reply_markup: {
                inline_keyboard: [[
                    { text: "Open Mini App", url: miniAppUrl }
                ]]
            }
        });

    } catch (error) {
        console.error('Error in start command:', error);
        await ctx.reply('Sorry, something went wrong. Please try again later.');
    }
});

// Setup webhook in production, use polling in development
export const initBot = async (app: express.Application): Promise<void> => {
    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_DOMAIN) {
        const secretPath = `/webhook-${bot.secretPathComponent()}`;

        // Setup webhook
        await bot.telegram.setWebhook(`${process.env.WEBHOOK_DOMAIN}${secretPath}`);
        console.log(`Webhook set to ${process.env.WEBHOOK_DOMAIN}${secretPath}`);

        // Handle webhook requests
        app.use(secretPath, express.json(), (req, res) => {
            bot.handleUpdate(req.body, res);
        });
    } else {
        // Development: Use long polling
        console.log('Using long polling for development');
        await bot.launch();
    }

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
};

// Add this to register bot commands with Telegram
export const registerBotCommands = async (): Promise<void> => {
    try {
        await bot.telegram.setMyCommands([
            { command: 'start', description: 'Start the bot and join Robota' }
        ]);
    } catch (error) {
        console.error('Error setting bot commands:', error);
    }
};