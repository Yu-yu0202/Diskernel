import { Client } from "discord.js";
import { Config } from "./config.js";
import { getCustomCoreLogger, Log } from "./logger.js";
import { ErrorHandler } from "./error.js";
import { Command } from "./command.js";
import { Event } from "./event.js";
import { Core as core } from "#types";

class DiskernelError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DiskernelError";
  }
}

const Logger = getCustomCoreLogger("master");

export class Core extends core {
  private static client: Client | undefined = undefined;

  public static get Client(): Client | undefined {
    if (!this.client) {
      Logger.warn("Client is not initialized!");
      return undefined;
    }
    return Core.client;
  }

  public static async start(): Promise<void> {
    await Log.whenReady();

    Logger.info("▶ Starting Bot...");

    const intents = Config.get("intents");
    Logger.debug(`Loaded ${intents.length} intents from configuration.`);

    Core.client ??= new Client({ intents: intents });
    Logger.info("✅ Initialized Discord client.");

    this.client!.on("debug", (m) => {
      Logger.trace(m);
    });

    this.client!.on("error", (e: Error) => {
      Logger.error(
        `\n ❌ Discord client error: ${e.message}\n    Stack: ${e.stack}\n    Cause: ${e.cause}`,
      );
    });

    this.client!.on("warn", (m) => {
      Logger.warn(`⚠ Discord client warn: ${m}`);
    });

    Logger.info("▶ Logging in to Discord...");
    Logger.trace(
      `Using token: ${Config.get("TOKEN").replace(/.(?=.{4})/g, "*")}`,
    );
    await this.client!
      .login(Config.get("TOKEN"))
      .catch(<T extends Error>(e: T) => {
        Logger.error("❌ Failed to login to Discord.");
        ErrorHandler.fatal("Failed to login to Discord", e);
      });

    this.client!.once("clientReady", () => {
      Logger.info(`✅ Logged in as ${Core.client!.user?.tag}`);
    });

    Logger.info("▶ Initializing commands...");
    await Command.initialize();
    Logger.info("✅ Commands initialized successfully.");

    Logger.info("▶ Initializing events...");
    if (!this.client) {
      throw new DiskernelError("Discord client is not initialized before events.");
    }
    await Event.initalize(this.client);
    Logger.info("✅ Events initialized successfully.");
  }

  public static stop(): void {
    Logger.info("▶ Stopping Bot...");
    this.client?.destroy().catch(<T extends Error>(e: T) => {
      throw new DiskernelError("Failed to destroy Discord client.", {
        cause: e,
      });
    });
    Logger.info("✅ Bot stopped successfully.");
  }
}
