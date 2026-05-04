import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb() {
  await mongoose.connect(env.MONGODB_URI, { dbName: env.MONGODB_DB_NAME });
  mongoose.set('strictQuery', true);
  return mongoose.connection;
}

