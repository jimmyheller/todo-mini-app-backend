import express from 'express';
import { createOrFetchUser, awardWelcomeToken, checkAndUpdateDailyStreak } from '../services/userService';

const router = express.Router();

router.post('/create-or-fetch', async (req, res) => {
  try {
    const user = await createOrFetchUser(req.body);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error creating or fetching user' });
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