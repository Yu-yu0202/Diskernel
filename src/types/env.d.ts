import { GatewayIntentBits } from "discord.js";

export type Intent = keyof typeof GatewayIntentBits;

/**
 * Logging configuration for the bot.
 */
export interface Logging {
  /** Logging level. One of 'debug', 'info', 'warn', 'error'. */
  level: "trace" | "debug" | "info" | "warning" | "error" | "fatal";
  /** Enable logging to a file. */
  enableFileLogging: boolean;
  /** File path for log output if file logging is enabled. */
  logFilePath: string;
}

/**
 * Database configuration.
 * Use a discriminated union to ensure type-specific properties.
 */
export type DB =
  | { id: string; type: "sqlite"; sqlite: { path: string } }
  | {
      id: string;
      type: "mysql";
      mysql: { host: string; user: string; password: string; database: string };
    };

/**
 * Feature toggles for the bot.
 */
export interface FeatureOptions {
  enableCommandAutoload: boolean;
  enableEventAutoload: boolean;
  enableAdminCommands: boolean;
  enableDevelopmentCommands: boolean;
}

/**
 * Bot-specific options.
 */
export interface Options {
  /** Array of Discord user IDs that have admin privileges. */
  adminIds: string[];
  /** Logging configuration */
  logging: Logging;
  /** Array of database configurations */
  db: DB[];
  /** Feature toggles */
  feature: FeatureOptions;
}

/**
 * Environment configuration for the Discord bot.
 *
 * @name EnvConfigT
 * @description This configuration object contains all necessary settings for the bot.
 * It includes authentication, intents, options for logging, database connections,
 * feature toggles, and custom environment variables.
 *
 * @property {string} TOKEN - Your Discord Bot Token. We highly recommend using process.env to manage your token securely.
 * @property {Intent[]} intents - Discord Gateway Intents your bot will use. Must be keys from GatewayIntentBits.
 * @property {Options} options - Additional options for your bot.
 */
export interface EnvConfigT {
  TOKEN: string;
  intents: Intent[];
  options: Options;
}

const Logging = {
  level: "level",
  enableFileLogging: "enableFileLogging",
  logFilePath: "logFilePath",
} as const;

const sqlite = {
  path: "path",
} as const;

const mysql = {
  host: "host",
  user: "user",
  password: "password",
  database: "database",
} as const;

const db = {
  id: "id",
  type: "type",
  sqlite: sqlite,
  mysql: mysql,
} as const;

const FeatureOptions = {
  enableCommandAutoload: "enableCommandAutoload",
  enableEventAutoload: "enableEventAutoload",
  enableAdminCommands: "enableAdminCommands",
  enableDevelopmentCommands: "enableDevelopmentCommands",
} as const;

const Options = {
  adminIds: "adminIds",
  logging: Logging,
  db: db,
  feature: FeatureOptions,
} as const;

export const EnvKeys = {
  TOKEN: "TOKEN",
  intents: "intents",
  options: Options,
} as const;
