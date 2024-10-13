import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import mongoose from 'mongoose';
import { connectRedis } from './config/redis';
import userRoutes from './routes/userRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000;

// Log environment variables (remove in production)
console.log('Environment variables:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
console.log('REDIS_URL:', process.env.REDIS_URL ? 'Set' : 'Not set');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? 'Set' : 'Not set');

app.use(express.json());
const corsOptions = {
  origin: '*', // This allows any origin
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

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