import { Config } from "../config.js";
import { DatabaseAdapter } from "./adapter.js";
import { getCustomCoreLogger } from "../logger.js";
import { DatabaseConstructor } from "#types";

const Logger = getCustomCoreLogger("database");

export class Database extends DatabaseConstructor {
  private static pools: Map<string, DatabaseAdapter> = new Map();

  public static initialize(): void {
    const DBConfigs = Config.get("options").db!;
    for (const DBConfig of DBConfigs) {
      Logger.debug(`Initializing database adapter for ${DBConfig.id}...`);
      const adapter = new DatabaseAdapter(DBConfig);
      this.pools.set(DBConfig.id, adapter);
      Logger.info(`✅️ Initialized database adapter for ${DBConfig.id}`);
    }
  }

  public static getConn(id: string): DatabaseAdapter | undefined {
    return this.pools.get(id);
  }
}
