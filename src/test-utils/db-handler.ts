import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

mongoose.set('strictQuery', false);

let mongod: MongoMemoryServer | undefined;
let isConnected = false;

export const connect = async () => {
    if (isConnected) return;

    mongod = await MongoMemoryServer.create({
        instance: {
            dbName: 'jest-test-db'
        }
    });
    const uri = mongod.getUri();

    await mongoose.connect(uri);
    isConnected = true;
};

export const closeDatabase = async () => {
    if (!isConnected) return;

    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
    isConnected = false;
};

export const clearDatabase = async () => {
    if (!isConnected) return;

    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
        await collection.deleteMany({});
    }
};