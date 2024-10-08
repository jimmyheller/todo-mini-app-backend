import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

export const connectRedis = async () => {
  await redisClient.connect();
};

export default redisClient;