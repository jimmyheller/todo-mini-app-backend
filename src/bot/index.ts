// src/bot/index.ts
import { Telegraf, Context } from 'telegraf';
import User, { IUser } from '../models/User';
import { generateReferralCode } from '../utils/referralCode';
import express from 'express';
import { Message } from 'telegraf/typings/core/types/typegram';

const bot = new Telegraf(process.env.BOT_TOKEN!);

// Add error handling middleware
bot.catch((err, ctx) => {
    console.error(`Bot error occurred:`, err);
    ctx.reply('An error occurred while processing your request').catch(console.error);
});

// Add logging middleware
bot.use(async (ctx, next) => {
    const start = new Date();
    console.log('Received update:', JSON.stringify(ctx.update, null, 2));

    try {
        await next();
    } catch (error) {
        console.error('Error in middleware:', error);
    }

    const ms = new Date().getTime() - start.getTime();
    console.log('Response time: %sms', ms);
});

// Handle /start command
bot.command('start', async (ctx) => {
    console.log('Start command received');

    try {
        const telegramId = ctx.from?.id;
        if (!telegramId) {
            console.log('No telegram ID found');
            await ctx.reply('Sorry, unable to process your request.');
            return;
        }

        // Get referral code if exists
        const referralCode = ctx.message?.text.split(' ')[1];
        console.log('Referral code:', referralCode);

        // Check if user exists
        let user = await User.findOne({ telegramId });
        console.log('Existing user:', user);

        if (!user) {
            console.log('Creating new user');
            user = new User({
                telegramId,
                username: ctx.from.username || '',
                firstName: ctx.from.first_name,
                lastName: ctx.from.last_name || '',
                referralCode: generateReferralCode(),
                referredByCode: referralCode,
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
            console.log('New user created:', user);

            // Handle referral reward
            if (referralCode) {
                console.log('Processing referral reward');
                const referrer = await User.findOne({ referralCode });
                if (referrer) {
                    referrer.rewardHistory.referrals = referrer.rewardHistory.referrals || {
                        lastCalculated: new Date(),
                        totalAwarded: 0
                    };
                    referrer.rewardHistory.referrals.totalAwarded += 1000;
                    referrer.tokens = (referrer.tokens || 0) + 1000;
                    await referrer.save();
                    console.log('Referrer rewarded:', referrer);
                }
            }
        }

        // Send welcome message
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
        console.log('Welcome message sent');

    } catch (error) {
        console.error('Error in start command:', error);
        await ctx.reply('Sorry, something went wrong. Please try again later.');
    }
});

export const initBot = async (app: express.Application): Promise<void> => {
    try {
        console.log('Initializing bot...');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('WEBHOOK_DOMAIN:', process.env.WEBHOOK_DOMAIN);

        if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_DOMAIN) {
            const secretPath = `/webhook-${bot.secretPathComponent()}`;
            const webhookUrl = `${process.env.WEBHOOK_DOMAIN}${secretPath}`;

            console.log('Setting webhook to:', webhookUrl);
            await bot.telegram.setWebhook(webhookUrl);

            app.use(secretPath, express.json(), (req, res) => {
                console.log('Received webhook request:', req.body);
                bot.handleUpdate(req.body, res);
            });

            console.log('Webhook setup complete');
        } else {
            console.log('Starting bot in polling mode');
            await bot.launch();
            console.log('Bot launched in polling mode');
        }

        // Test the bot connection
        const botInfo = await bot.telegram.getMe();
        console.log('Bot info:', botInfo);

    } catch (error) {
        console.error('Error initializing bot:', error);
        throw error;
    }
};

// Register commands with Telegram
export const registerBotCommands = async (): Promise<void> => {
    try {
        console.log('Registering bot commands...');
        await bot.telegram.setMyCommands([
            { command: 'start', description: 'Start the bot and join Robota' }
        ]);
        console.log('Bot commands registered');
    } catch (error) {
        console.error('Error setting bot commands:', error);
        throw error;
    }
};