import { GatewayIntentBits } from "discord.js";

export type Intent = keyof typeof GatewayIntentBits;

export type Logging =
  | {
    level: "trace" | "debug" | "info" | "warning" | "error" | "fatal";
    enableFileLogging: false;
  }
  | {
    level: "trace" | "debug" | "info" | "warning" | "error" | "fatal";
    enableFileLogging: true;
    logFilePath: string;
  }

export interface FeatureOptions {
  enableCommandAutoload: boolean;
  commandAutoloadPath?: string;
  enableEventAutoload: boolean;
  eventAutoloadPath?: string;
  enableAdminCommands: boolean;
  enableDevelopmentCommands: boolean;
}

export interface Options {
  adminIds?: string[];
  logging: Logging;
  feature: FeatureOptions;
}

export interface ConfigT {
  TOKEN: string;
  intents: Intent[];
  options: Options;
}
