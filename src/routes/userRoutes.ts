// src/routes/userRoutes.ts
import express from 'express';
import { createOrFetchUser, awardWelcomeToken, checkAndUpdateDailyStreak, getUserRank, getInitials, getUserWithFriends } from '../services/userService';
import { validateTelegramWebAppData } from '../utils/telegramAuth';
import User from '../models/User';
import { checkStreakShown, markStreakShown } from '../utils/redisHelpers';

interface RewardsResponse {
  accountAge: {
    amount: number;
    lastCalculated: Date;
  };
  premium: {
    amount: number;
    lastCalculated: Date;
  };
  dailyCheckin: {
    amount: number;
    lastCalculated: Date;
  };
}

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

router.get('/home/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await checkAndUpdateDailyStreak(Number(telegramId)); // This will also update rewards
    const rank = await getUserRank(Number(telegramId));
    // Format the response according to the home page needs
    const response = {
      user: {
        username: user.username,
        firstName: user.firstName,
        balance: user.tokens,
        initials: getInitials(user.firstName, user.lastName),
        rank: rank
      },
      rewards: {
        accountAge: {
          amount: user.rewardHistory?.accountAge?.totalAwarded || 0,
          lastCalculated: user.rewardHistory?.accountAge?.lastCalculated
        },
        premium: {
          amount: user.rewardHistory?.premium?.totalAwarded || 0,
          lastCalculated: user.rewardHistory?.premium?.lastCalculated
        },
        dailyCheckin: {
          amount: user.rewardHistory?.dailyCheckin?.totalAwarded || 0,
          lastCalculated: user.rewardHistory?.dailyCheckin?.lastCalculated
        },
        invitedFriends: {
          amount: user.rewardHistory?.referrals?.totalAwarded || 0,
          count: await User.countDocuments({ referredByCode: user.referralCode })
        }
      },
      stats: {
        currentStreak: user.currentStreak,
        isPremium: user.isPremium
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching home data:', error);
    res.status(500).json({ message: 'Error fetching home data' });
  }
});

router.get('/friends/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const friendsData = await getUserWithFriends(Number(telegramId));
    res.json(friendsData);
  } catch (error) {
    console.error('Error fetching friends data:', error);
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({ message: 'User not found' });
    } else {
      res.status(500).json({ message: 'Error fetching friends data' });
    }
  }
});

router.get('/should-show-streak/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const timezoneOffset = parseInt(req.query.timezoneOffset as string) || 0;

    const shown = await checkStreakShown(telegramId, timezoneOffset);

    res.json({
      shouldShow: !shown
    });
  } catch (error) {
    console.error('Error checking streak visibility:', error);
    res.status(500).json({ message: 'Error checking streak visibility' });
  }
});

router.post('/process-daily-streak', async (req, res) => {
  try {
    const { telegramId, timezoneOffset } = req.body;

    // First check if already shown today
    const shown = await checkStreakShown(telegramId, timezoneOffset);
    if (shown) {
      return res.status(400).json({
        message: 'Streak already processed today',
        shouldRedirect: true
      });
    }

    // Mark as shown in Redis
    await markStreakShown(telegramId, timezoneOffset);

    // Process streak rewards
    const user = await checkAndUpdateDailyStreak(Number(telegramId));

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error processing streak:', error);
    res.status(500).json({ message: 'Error processing streak' });
  }
});

export default router;