import express from 'express';
import { createOrFetchUser, awardWelcomeToken, checkAndUpdateDailyStreak } from '../services/userService';
import { validateTelegramWebAppData } from '../utils/telegramAuth';


const router = express.Router();

router.post('/authenticate', async (req, res) => {
  console.log('authenticate', req.body);
  try {
    const { initData } = req.body;
    console.log('initData', initData);
    const validatedData = validateTelegramWebAppData(initData);

    if (!validatedData) {
      return res.status(401).json({ message: 'Invalid authentication data' });
    }

    const user = await createOrFetchUser(validatedData.user);

    // Here you might generate a session token or JWT for the user
    // For simplicity, we're just sending the user data back
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error authenticating user' });
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
    const user = await checkAndUpdateDailyStreak(telegramId);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error checking daily streak' });
  }
});

export default router;