/**
 * Centralized configuration module.
 * This is the ONLY place where process.env is accessed.
 * All other modules import from here.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  database: {
    url: requireEnv("DATABASE_URL"),
  },
  jwt: {
    accessSecret: requireEnv("JWT_ACCESS_SECRET"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
    accessExpiresIn: optionalEnv("JWT_ACCESS_EXPIRES_IN", "15m"),
    refreshExpiresIn: optionalEnv("JWT_REFRESH_EXPIRES_IN", "30d"),
  },
  encryption: {
    key: requireEnv("ENCRYPTION_KEY"),
  },
  server: {
    port: parseInt(optionalEnv("PORT", "4000"), 10),
    nodeEnv: optionalEnv("NODE_ENV", "development"),
    corsOrigin: optionalEnv("CORS_ORIGIN", "http://localhost:3000"),
  },
  whatsapp: {
    apiUrl: optionalEnv("EVOLUTION_API_URL", ""),
    apiKey: optionalEnv("EVOLUTION_API_KEY", ""),
    instanceName: optionalEnv("EVOLUTION_INSTANCE_NAME", ""),
  },
  meroshare: {
    referenceAccountUsername: optionalEnv("REFERENCE_ACCOUNT_USERNAME", ""),
  },
} as const;

export type Config = typeof config;
