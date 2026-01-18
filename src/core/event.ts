import path from "path";
import fs from "fs";
import type { Client, ClientEvents } from "discord.js";
import { getCustomCoreLogger } from "./logger.js";
import { Event as event, type EventT } from "../types/index.js";

type InferEventName<T> = T extends EventT<infer K> ? K : never;
type EventArgs<T> = ClientEvents[InferEventName<T>];
const Logger = getCustomCoreLogger("events");

export class Event extends event {
  private static events: EventT[] = [];

  public static async initalize(client: Client): Promise<void> {
    await this.loadEventFromDir(path.resolve(process.cwd(), "dist", "events"));
    this.registerEvents(client);
  }

  private static async loadEventFromDir(dir: string): Promise<boolean> {
    try {
      const files = await fs.promises.readdir(dir);
      await Promise.all(
        files
          .filter((f) => f.endsWith(".js"))
          .map(async (file) => {
            const filePath = path.join(dir, file);
            try {
              const module = await import(filePath);
              let event: any = module.default ?? Object.values(module)[0];

              if (event && typeof event === "function" && event.prototype) {
                try {
                  event = new event();
                } catch (_e) {
                  Logger.warn(`❌️ Failed to instantiate event class: ${file}`);
                  return;
                }
              }

              if (
                event &&
                typeof event.event === "string" &&
                typeof event.execute === "function"
              ) {
                this.events.push(event);
                Logger.debug(`✅️ Loaded event: ${file}`);
              } else {
                Logger.warn(`❌️ Invalid event: ${file}`);
              }
            } catch {
              Logger.warn(`❌️ Failed to import event: ${file}`);
            }
          }),
      );
      return true;
    } catch {
      Logger.warn(`⚠ Event folder does not exist: ${dir}`);
      return false;
    }
  }

  private static registerEvents(client: Client): void {
    for (const event of this.events) {
      Logger.debug(`Processing event: ${event.event}`);
      if (event.once) {
        client.once(event.event, (...args: EventArgs<typeof event>) =>
          event.execute(...args),
        );
        Logger.debug(`✅️ Registered once event: ${event.event}`);
      } else {
        client.on(event.event, (...args: EventArgs<typeof event>) =>
          event.execute(...args),
        );
        Logger.debug(`✅️ Registered normal event: ${event.event}`);
      }
    }
    return;
  }
}
