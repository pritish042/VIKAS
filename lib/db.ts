import 'server-only';
import { MongoClient } from 'mongodb';
import { configureMongoDns } from './mongo-dns';
const g = globalThis as unknown as { mongoClient?: MongoClient; mongoConnected?: Promise<MongoClient> };
export function configured() { return Boolean(process.env.MONGODB_URI && process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL); }
export function mongoClient() {
 if (!process.env.MONGODB_URI) throw new Error('Database is not configured.');
 if (!g.mongoClient) {
  configureMongoDns(process.env.MONGODB_DNS_SERVERS);
  g.mongoClient = new MongoClient(process.env.MONGODB_URI, {maxPoolSize:10,serverSelectionTimeoutMS:5000});
 }
 return g.mongoClient;
}
export async function db() {
 if (!g.mongoConnected) g.mongoConnected = mongoClient().connect().catch(e=>{g.mongoConnected=undefined; throw e;});
 return (await g.mongoConnected).db(process.env.MONGODB_DB || 'vikas');
}
