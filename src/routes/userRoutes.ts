import express from 'express';
import { createOrFetchUser, awardWelcomeToken, checkAndUpdateDailyStreak } from '../services/userService';
import { validateTelegramWebAppData } from '../utils/telegramAuth';
import User from '../models/User';  // Add this import

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

router.post('/daily-streak', async (req, res) => {
  try {
    const { telegramId } = req.body;
    const user = await checkAndUpdateDailyStreak(telegramId);
    res.json(user);
  } catch (error) {
    console.log('exception in daily-streak', error);
    res.status(500).json({ message: 'Error checking daily streak' });
  }
});

// New endpoint for home page data
function getInitials(firstName: string = '', lastName: string = ''): string {
  const firstInitial = firstName.charAt(0).toUpperCase();
  const lastInitial = lastName.charAt(0).toUpperCase();

  if (firstInitial && lastInitial) {
    return `${firstInitial}${lastInitial}`;
  } else if (firstInitial) {
    return firstInitial + firstInitial;
  } else {
    return 'OR'; // Default fallback
  }
}

router.get('/home/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await checkAndUpdateDailyStreak(Number(telegramId)); // This will also update rewards

    // Format the response according to the home page needs
    const response = {
      user: {
        username: user.username,
        firstName: user.firstName,
        balance: user.tokens,
        initials: getInitials(user.firstName, user.lastName)
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

export default router;