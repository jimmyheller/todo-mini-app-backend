export const isDevelopment = process.env.NODE_ENV === 'development';
export const isTest = process.env.NODE_ENV === 'test';
export const isProd = process.env.NODE_ENV === 'production';

export const config = {
    mongoUri: process.env.MONGODB_URI,
    redisUrl: process.env.REDIS_URL,
    botToken: process.env.BOT_TOKEN,
    port: process.env.PORT || 3000,
    webhookDomain: process.env.WEBHOOK_DOMAIN
};