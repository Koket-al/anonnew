import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/anon_db';
  try {
    await mongoose.connect(uri);
    console.log(`[Database] Connected to MongoDB at ${uri.replace(/\/\/.*@/, '//<credentials>@')}`);
  } catch (error) {
    console.error('[Database] MongoDB connection error:', error.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB disconnected');
  });
}
