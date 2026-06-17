import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/modules/*/**.schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? (() => { throw new Error("DATABASE_URL is required"); })(),
  },
  verbose: true,
  strict: true,
});
