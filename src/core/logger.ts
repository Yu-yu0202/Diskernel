import fs from "fs";
import path from "path";
import {
  configure,
  getConsoleSink,
  getAnsiColorFormatter,
  getLogger,
  type Logger as LoggerT,
} from "@logtape/logtape";
import { getRotatingFileSink } from "@logtape/file";
import { Config, Log as log, type Logging } from "#types";

export class Log extends log {
  private static isInitalized: boolean = false;
  public static readonly LOGGER_READY: symbol = Symbol.for("diskernel.logger.ready");
  private static _ready?: Promise<void>;

  private static createLogDirIfNotExists(dir: string): void {
    dir = path.dirname(dir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }


  public static async initalizeMainLogger(options?: Logging): Promise<void> {
    if (this._ready) {
      await this._ready;
      return;
    }
    const ready: Promise<void> = (async () => {
      if (this.isInitalized) {
        return;
      }
      if (!options) {
        options = Config.get("options")?.logging ?? {
          level: "info",
          enableFileLogging: false
        };
      }
      if (options.enableFileLogging) {
        this.createLogDirIfNotExists(options.logFilePath);
      }
      await configure({
        sinks: {
          meta: getConsoleSink({
            formatter: getAnsiColorFormatter(),
          }),
          console: getConsoleSink({
            formatter: getAnsiColorFormatter(),
          }),
          ...(options.enableFileLogging
            ? {
              file: getRotatingFileSink(options.logFilePath, {
                maxSize: 4 * 1024 * 1024,
                maxFiles: 4,
                nonBlocking: true,
                bufferSize: 512 * 1024,
                flushInterval: 100
              }),
            }
            : {}),
        },
        filters: {},
        loggers: [
          {
            category: ["logtape", "meta"],
            lowestLevel: "warning",
            sinks: ["meta"],
          },
          {
            category: "[diskernel]",
            lowestLevel: options.level ?? "info",
            sinks: [
              "console",
              ...(options.enableFileLogging ? ["file"] : []),
            ],
          },
          {
            category: "main",
            lowestLevel: options.level ?? "info",
            sinks: [
              "console",
              ...(options.enableFileLogging ? ["file"] : []),
            ],
          },
        ],
      });
      this.isInitalized = true;
    })();
    this.setReady(ready);
    await ready;
  }

  public static get get(): ReturnType<typeof getLogger> {
    return getLogger("main");
  }


  public static setReady(promise: Promise<void>): void {
    this._ready = promise;
  }

  public static getReady(): Promise<void> {
    return this._ready ?? Promise.resolve();
  }

  public static async whenReady(): Promise<void> {
    await this.getReady();
  }
}

export const Logger: (cat?: string | string[]) => LoggerT = (cat?: string | string[]) => {
  return getLogger(["main", ...(cat instanceof Array ? cat : cat ? [cat] : [])]);
};
export const CoreLogger: LoggerT = getLogger("[diskernel]");
export function getCustomCoreLogger(category: string | string[]) {
  return getLogger(["[diskernel]", ...(category instanceof Array ? category : [category])]);
}
