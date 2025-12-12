import { GatewayIntentBits } from "discord.js";
import { type ConfigT, type Intent, Config as config } from "#types";
import { Log } from "./logger.js";

class EnvConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EnvConfigError";
  }
}

export class Config extends config {
  protected static instance: ConfigT;

  private static validateConfig(config: ConfigT): void {
    if (!config.TOKEN || typeof config.TOKEN !== "string") {
      throw new EnvConfigError("Invalid or missing TOKEN in configuration.");
    }

    if (!config.intents || config.intents.length === 0) {
      throw new EnvConfigError(
        "At least one intent must be specified in configuration.",
      );
    }

    const validIntents: Intent[] = Object.keys(GatewayIntentBits) as Intent[];
    for (const intent of config.intents) {
      if (!validIntents.includes(intent)) {
        throw new EnvConfigError(`Invalid intent specified: ${intent}`);
      }
    }

    if (config.options) {
      if (
        config.options.adminIds &&
        (!Array.isArray(config.options.adminIds) ||
          config.options.adminIds.some((id) => typeof id !== "string"))
      ) {
        throw new EnvConfigError("adminIds must be an array of strings.");
      }

      if (config.options.logging) {
        if (
          ![
            "trace",
            "debug",
            "info",
            "warning",
            "error",
            "fatal",
          ].includes(config.options.logging.level)
        ) {
          throw new EnvConfigError(
            "Logging level must be one of 'trace', 'debug', 'info', 'warning', 'error', 'fatal'.",
          );
        }

        if (typeof config.options.logging.enableFileLogging !== "boolean") {
          throw new EnvConfigError("enableFileLogging must be a boolean.");
        }

        if (
          config.options.logging.enableFileLogging &&
          (typeof config.options.logging.logFilePath !== "string" ||
            config.options.logging.logFilePath.trim() === "")
        ) {
          throw new EnvConfigError(
            "logFilePath must be a non-empty string when file logging is enabled.",
          );
        }
      }

      if (config.options.db) {
        for (const dbConfig of config.options.db) {
          if (!dbConfig.id || typeof dbConfig.id !== "string") {
            throw new EnvConfigError(
              "Each database configuration must have a valid string id.",
            );
          }

          if (
            dbConfig.type === "sqlite" &&
            (!dbConfig.sqlite || typeof dbConfig.sqlite?.path !== "string")
          ) {
            throw new EnvConfigError(
              `in ${dbConfig.id}: SQLite configuration must include a valid path.`,
            );
          } else if (dbConfig.type === "mysql") {
            if (
              !dbConfig.mysql ||
              typeof dbConfig.mysql.host !== "string" ||
              typeof dbConfig.mysql.user !== "string" ||
              typeof dbConfig.mysql.password !== "string" ||
              typeof dbConfig.mysql.database !== "string"
            ) {
              throw new EnvConfigError(
                `in ${dbConfig.id}: MySQL configuration must include valid host, user, password, and database.`,
              );
            }
          }
        }
      }

      if (config.options.feature) {
        if (
          typeof config.options.feature.enableCommandAutoload !== "boolean" ||
          typeof config.options.feature.enableEventAutoload !== "boolean" ||
          typeof config.options.feature.enableAdminCommands !== "boolean" ||
          typeof config.options.feature.enableDevelopmentCommands !== "boolean"
        ) {
          throw new EnvConfigError(
            "All feature options must be boolean values.",
          );
        }
      }
    } else {
      throw new EnvConfigError("options field is required in configuration.");
    }
  }

  constructor(config: ConfigT) {
    super();
    if (Config.instance) {
      return;
    }
    Config.validateConfig(config);
    Config.instance = config;
    Log.initalizeMainLogger(config.options.logging);
  }

  public static get<K extends keyof ConfigT>(key: K): ConfigT[K] {
    if (!Config.instance) {
      throw new EnvConfigError(
        "Config is not initialized!",
      );
    }
    return Config.instance[key];
  }

  public static isInitialized(): boolean {
    return Config.instance !== undefined;
  }
}
