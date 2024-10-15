import express from 'express';
import { createOrFetchUser, awardWelcomeToken, checkAndUpdateDailyStreak } from '../services/userService';
import { validateTelegramWebAppData } from '../utils/telegramAuth';


const router = express.Router();

router.post('/authenticate', async (req, res) => {
  try {
    const { initData } = req.body;
    const validatedData = validateTelegramWebAppData(initData);

    if (!validatedData) {
      console.log('invalid authentication data');
      return res.status(401).json({ message: 'Invalid authentication data' });
    }
    const user = await createOrFetchUser(validatedData.user);
    res.json(user);
  } catch (error: any) {
    console.error('Error in /authenticate:', error);
    if (error.message === 'Failed to create or fetch user') {
      res.status(500).json({ message: 'Unable to create or fetch user. Please try again.' });
    } else {
      res.status(500).json({ message: 'Error authenticating user' });
    }
  }
});

router.post('/welcome-token', async (req, res) => {
  try {
    const { telegramId } = req.body;
    const user = await awardWelcomeToken(telegramId);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error awarding welcome token' });
  }
});

router.post('/daily-streak', async (req, res) => {
  try {
    const { telegramId } = req.body;
    console.log('telegramId', telegramId);
    const user = await checkAndUpdateDailyStreak(telegramId);
    console.log('user', user);
    res.json(user);
    console.log('res.json(user)', res.json(user));
  } catch (error) {
    console.log('exception in daily-streak', error);
    res.status(500).json({ message: 'Error checking daily streak' });
  }
});

export default router;