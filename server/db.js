require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/User');
const Challan = require('./models/Challan');
const CatalogItem = require('./models/CatalogItem');
const MovementHistory = require('./models/MovementHistory');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shubhsajawat';

// Global cache for Serverless (Vercel) & Node environment connection persistence
let cached = global.mongooseConnection;

if (!cached) {
  cached = global.mongooseConnection = { conn: null, promise: null };
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is missing on Vercel.');
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
    };

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      console.log(`[MongoDB Atlas] Connected successfully to: ${mongooseInstance.connection.name}`);
      return mongooseInstance;
    }).catch((err) => {
      cached.promise = null;
      console.error('[MongoDB Connection Error]:', err.message);
      throw err;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

// Initial eager connection attempt
connectDB().catch(() => {});

module.exports = {
  connectDB,
  isMongoConnected,
  models: {
    User,
    Challan,
    CatalogItem,
    MovementHistory
  }
};
