// src/scripts/hideUser.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User').default;

async function hideUser(telegramId) {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await User.updateOne(
            { telegramId },
            { $set: { hidden: true } }
        );

        console.log(`\nProcessing telegramId ${telegramId}:`);

        if (result.matchedCount === 0) {
            console.log('❌ No user found with this telegramId');
        } else if (result.modifiedCount === 0) {
            console.log('ℹ️ User found but no changes were needed');
        } else {
            console.log('✅ User successfully hidden');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

const telegramId = parseInt(process.argv[2]);

if (!telegramId || isNaN(telegramId)) {
    console.error('Please provide a valid Telegram ID as an argument');
    console.error('Usage: node hideUser.js 123456789');
    process.exit(1);
}

hideUser(telegramId);