import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';
dotenv.config();

let DATABASE_URL = process.env.DATABASE_URL;

const client = postgres(DATABASE_URL as string);
export const db = drizzle(client, { schema, logger: true });