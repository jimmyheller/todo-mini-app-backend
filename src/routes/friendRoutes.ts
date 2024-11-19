import {getUserWithFriends} from "../services/friendService";
import express from "express";


const router = express.Router();

router.get('/:telegramId', async (req, res) => {
    try {
        const {telegramId} = req.params;
        const friendsData = await getUserWithFriends(Number(telegramId));
        res.json(friendsData);
    } catch (error) {
        console.error('Error fetching friends data:', error);
        if (error instanceof Error && error.message === 'User not found') {
            res.status(404).json({message: 'User not found'});
        } else {
            res.status(500).json({message: 'Error fetching friends data'});
        }
    }
});

export default router;