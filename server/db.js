require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Challan = require('./models/Challan');
const CatalogItem = require('./models/CatalogItem');
const MovementHistory = require('./models/MovementHistory');

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shubhsajawat';

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

async function tryConnectMongoDB() {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log(`[MongoDB] Connected successfully to MongoDB Atlas.`);
  } catch (err) {
    // Retry automatically via interval
  }
}

// Initial connection attempt
tryConnectMongoDB().then(() => {
  if (!isMongoConnected()) {
    console.log(`[MongoDB Notice] Database URI configured. Connecting in background...`);
  }
});

// Periodic retry every 10 seconds to ensure resilient connection
setInterval(tryConnectMongoDB, 10000);

// File-based store
class Database {
  constructor() {
    this._data = { users: [], catalog: [], challans: [], history: [] };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this._data = JSON.parse(raw);
        if (!this._data.users) this._data.users = [];
        if (!this._data.catalog) this._data.catalog = initialSeedCatalog;
        if (!this._data.challans) this._data.challans = [];
        if (!this._data.history) this._data.history = [];
      } else {
        this._data = {
          users: [],
          catalog: initialSeedCatalog,
          challans: [],
          history: []
        };
        this.save();
      }
    } catch (e) {
      this._data = { users: [], catalog: initialSeedCatalog, challans: [], history: [] };
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this._data, null, 2), 'utf8');
    } catch (e) {}
  }

  get data() {
    this.load();
    return this._data;
  }

  set data(val) {
    this._data = val;
  }
}

const db = new Database();
db.db = db;
db.isMongoConnected = isMongoConnected;
db.models = { User, Challan, CatalogItem, MovementHistory };

module.exports = db;
module.exports.db = db;
module.exports.isMongoConnected = isMongoConnected;
module.exports.models = {
  User,
  Challan,
  CatalogItem,
  MovementHistory
};
