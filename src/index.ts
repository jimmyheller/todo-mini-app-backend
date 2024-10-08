import express from 'express';
import mongoose from 'mongoose';
import { connectRedis } from './config/redis';
import userRoutes from './routes/userRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI as string)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Connect to Redis
connectRedis()
  .then(() => console.log('Connected to Redis'))
  .catch((err) => console.error('Redis connection error:', err));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Todo API' });
});

app.use('/api/users', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});