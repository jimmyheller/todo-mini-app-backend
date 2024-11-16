// src/scripts/hideUser.ts
import mongoose from 'mongoose';
import User from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

async function hideUser(telegramId: number) {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('Connected to MongoDB');

        const result = await User.updateOne(
            {telegramId},
            {$set: {hidden: true}}
        );

        console.log(`Updated user with telegramId ${telegramId}:`, result);

        if (result.matchedCount === 0) {
            console.log('No user found with this telegramId');
        } else if (result.modifiedCount === 0) {
            console.log('User found but no changes were needed');
        } else {
            console.log('User successfully hidden');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Get Telegram ID from command line argument
const telegramId = parseInt(process.argv[2]);

if (!telegramId) {
    console.error('Please provide a Telegram ID as an argument');
    console.error('Usage: npm run hide-user -- 123456789');
    process.exit(1);
}

if (isNaN(telegramId)) {
    console.error('Please provide a valid numeric Telegram ID');
    process.exit(1);
}

hideUser(telegramId);