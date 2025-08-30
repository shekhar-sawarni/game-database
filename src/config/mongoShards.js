import mongoose from 'mongoose';

const userShardConns = new Map();
const resultShardConns = new Map();
let resultsDefaultConn = null;
let usersDefaultConn = null;

function parseShards(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr || '{}');
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  return {};
}

const userShardsConfig = parseShards(process.env.MONGO_USERS_SHARDS_JSON || process.env.MONGO_SHARDS_JSON);
const resultShardsConfig = parseShards(process.env.MONGO_RESULTS_SHARDS_JSON);
const resultsDefaultUri = process.env.MONGO_RESULTS_URI || '';
const usersDefaultUri = process.env.MONGO_USERS_URI || process.env.MONGO_URI || '';

export function getMongooseForCountry(countryCode) {
  const cc = String(countryCode || '').toUpperCase();
  if (!cc) {
    if (usersDefaultUri) {
      if (!usersDefaultConn) usersDefaultConn = mongoose.createConnection(usersDefaultUri, { autoIndex: true });
      return usersDefaultConn;
    }
    return null;
  }
  if (userShardConns.has(cc)) return userShardConns.get(cc);
  const uri = userShardsConfig[cc];
  if (!uri) return null;
  const conn = mongoose.createConnection(uri, { autoIndex: true });
  userShardConns.set(cc, conn);
  return conn;
}

export function listMongoShardCountries() {
  return Object.keys(userShardsConfig);
}

export function getResultsMongooseForCountry(countryCode) {
  const cc = String(countryCode || '').toUpperCase();
  if (cc && resultShardConns.has(cc)) return resultShardConns.get(cc);
  const uri = cc ? resultShardsConfig[cc] : '';
  if (uri) {
    const conn = mongoose.createConnection(uri, { autoIndex: true });
    resultShardConns.set(cc, conn);
    return conn;
  }
  if (resultsDefaultUri) {
    if (!resultsDefaultConn) {
      resultsDefaultConn = mongoose.createConnection(resultsDefaultUri, { autoIndex: true });
    }
    return resultsDefaultConn;
  }
  return null;
}


