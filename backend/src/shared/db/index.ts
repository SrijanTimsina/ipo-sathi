import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../../config/index.js";

const queryClient = postgres(config.database.url);

export const db = drizzle(queryClient);

export type Database = typeof db;
