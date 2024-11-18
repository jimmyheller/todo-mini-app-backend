// src/routes/streakRoutes.ts
import express from 'express';
import { checkStreakStatus } from '../services/streakService';

const router = express.Router();

router.get('/check/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const clientTimezoneOffset = parseInt(req.query.tzOffset as string) || 0;

        const streakStatus = await checkStreakStatus(
            Number(telegramId),
            clientTimezoneOffset
        );

        res.json(streakStatus);
    } catch (error) {
        console.error('Error checking streak status:', error);
        res.status(500).json({ message: 'Error checking streak status' });
    }
});

export default router;