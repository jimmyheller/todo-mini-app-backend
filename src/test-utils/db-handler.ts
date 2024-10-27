import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | null = null;

/**
 * Connect to the in-memory database.
 */
export const connect = async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const mongooseOpts = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    };

    await mongoose.connect(uri);
};

/**
 * Drop database, close the connection and stop mongod.
 */
export const closeDatabase = async () => {
    if (mongod) {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongod.stop();
    }
};

/**
 * Remove all the data for all db collections.
 */
export const clearDatabase = async () => {
    if (mongod) {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            const collection = collections[key];
            await collection.deleteMany({});
        }
    }
};