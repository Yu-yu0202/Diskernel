import { Core } from "./core/client.js";
import { Command } from "./core/command.js";
import { Event } from "./core/event.js";
import { Config } from "./core/config.js";
import { ErrorHandler } from "./core/error.js";
import { Log, Logger } from "./core/logger.js";

export { Core, Command, Event, Config, ErrorHandler, Log, Logger };
export const Diskernel = {
  Core,
  Command,
  Event,
  Config,
  ErrorHandler,
  Log,
  Logger,
};

export * from "./types/index.js";
