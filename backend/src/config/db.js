const mongoose = require('mongoose');
let _memServer = null;

/* Callbacks registered via onConnected() are fired once when MongoDB
   transitions to readyState === 1 for the first time.  Used by modules
   that need to migrate in-memory data to the DB after a late connection. */
const _onConnectedCallbacks = [];

const onConnected = (fn) => {
  if (mongoose.connection.readyState === 1) {
    // already connected — fire immediately
    fn();
  } else {
    _onConnectedCallbacks.push(fn);
  }
};

const connectDB = async () => {
  let uri = process.env.MONGO_URI;

  // In production, ignore localhost MONGO_URI because localhost MongoDB does not exist on cloud servers like Render
  if (process.env.NODE_ENV === 'production' && uri && (uri.includes('localhost') || uri.includes('127.0.0.1') || uri.includes('::1'))) {
    console.log('[DB] Cloud production mode — ignoring localhost MONGO_URI');
    uri = null;
  }

  // No URI → start an embedded MongoDB so the app still uses a real DB
  if (!uri) {
    try {
      // lazily require to avoid the dependency when not needed in production
      const { MongoMemoryServer } = require('mongodb-memory-server');
      _memServer = await MongoMemoryServer.create();
      uri = _memServer.getUri();
      process.env.MONGO_URI = uri;
      // signal to the rest of the app that seeding should run by default
      if (!process.env.SEED_DB) process.env.SEED_DB = 'true';
      console.log('[DB] Started embedded MongoDB instance');
    } catch (err) {
      console.warn('[DB] Embedded MongoDB fallback note:', err.message);
      return;
    }
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,  // fail fast if Atlas is unreachable
      socketTimeoutMS:          45000,
    });
    console.log(`[DB] MongoDB connected: ${mongoose.connection.host}`);
    _onConnectedCallbacks.forEach(fn => { try { fn(); } catch (_) {} });
    _onConnectedCallbacks.length = 0;
  } catch (err) {
    console.warn('[DB] Operating with in-memory telemetry store:', err.message);
  }
};

const isConnected = () => mongoose.connection.readyState === 1;

module.exports = { connectDB, isConnected, onConnected };
