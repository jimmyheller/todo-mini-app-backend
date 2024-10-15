import express from 'express';
import { getLeaderboard } from '../services/leaderboardService';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const { leaderboard, total } = await getLeaderboard(limit, offset);

    res.json({
      leaderboard,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Leaderboard Error:', error);
    res.status(500).json({ 
      message: 'Error fetching leaderboard',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;