import express from 'express';
import User from '../models/User';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const users = await User.find()
      .sort({ tokens: -1 })
      .skip(offset)
      .limit(limit);

    const total = await User.countDocuments();

    const leaderboard = users.map((user, index) => ({
      rank: offset + index + 1,
      id: user.id,
      name: user.username,
      tokens: user.tokens,
      streaks: user.currentStreak,
    }));

    res.json({
      leaderboard,
      total,
      limit,
      offset,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});

export default router;