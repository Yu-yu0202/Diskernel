import { Core } from "./client.js";
import { getCustomCoreLogger } from "./logger.js";
import { ErrorHandler as errorhandler } from "#types";

const Logger = getCustomCoreLogger("errorHandler");

export class ErrorHandler extends errorhandler {
  static {
    process.on("uncaughtException", (e) => this.uncaughtException(e));
    process.on("unhandledRejection", (reason, promise) =>
      this.unhandledRejection(reason, promise),
    );
    process.on("SIGINT", () => this.shutdownHandler("SIGINT"));
    process.on("SIGTERM", () => this.shutdownHandler("SIGTERM"));
    process.on("SIGQUIT", () => this.shutdownHandler("SIGQUIT"));
  }

  private static uncaughtException<T extends Error>(error: T): void {
    Logger.fatal(
      `Uncaught Exception: ${error.message}${error.stack ? `\nStack Trace: ${error.stack}` : ""}${error.cause ? `\nCaused by: ${error.cause}` : ""}`,
    );
    this.shutdownHandler("uncaughtException", error.message);
  }

  private static unhandledRejection<T>(reason: T, promise: Promise<T>): void {
    Logger.warn(
      `Unhandled Rejection at: ${promise}${reason instanceof Error ? `\nReason: ${reason.message}${reason.stack ? `\nStack Trace: ${reason.stack}` : ""}${reason.cause ? `\nCaused by: ${reason.cause}` : ""}` : `\nReason: ${reason}`}`,
    );
  }

  private static shutdownHandler(
    signal?: string | NodeJS.Signals,
    reason?: string,
  ): void {
    Logger.warn(
      `Shutdown due to ${signal ?? "unknown"}${reason ? `, Reason: ${reason}` : ""}...`,
    );
    try {
      Core.stop();
    } catch (_) {
      // ignore errors when Core is not initialized yet
    }
    process.exit(signal === "normal shutdown" ? 0 : 1);
  }

  public static fatal(reason?: string, error?: Error): void {
    Logger.fatal(
      `\n :( A fatal error has occured :( \n    Reason: ${reason ?? "No reason provided"} \n    Error: ${error?.message ?? "No error provided"} \n    Stack: ${error?.stack ?? "No stack provided"} \n    Cause: ${error?.cause ?? "No cause provided"}`,
    );
    this.shutdownHandler("fatal error");
  }
}
