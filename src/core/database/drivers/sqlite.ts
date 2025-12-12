import sqlite from "better-sqlite3";
import { randomUUID } from "crypto";
import { getCustomCoreLogger } from "../../logger.js";
import type { DB as DBConfigT } from "../../../types/config.js";
import { DBDriver } from "../../../types/abstract/database.abc.js";
import { type DBResult } from "../../../types/database.js";
import type { Logger } from "@logtape/logtape";
import { SchemaType } from "../../../types/database.js";

export class SQLiteDriver implements DBDriver {
  private Logger: Logger;

  private db: sqlite.Database | undefined;
  private config: Extract<DBConfigT, { type: "sqlite" }>;
  private transactionDepth = 0;
  private savepointStack: string[] = [];
  private optimizeTimer: NodeJS.Timeout | undefined;

  constructor(config: Extract<DBConfigT, { type: "sqlite" }>) {
    this.config = config;
    this.Logger = getCustomCoreLogger(["database", config.id]);
  }

  public async connect(): Promise<void> {
    if (this.db) return;
    this.db = new sqlite(this.config.sqlite.path);
    if (!this.config.sqlite.DisableWAL) this.db.pragma("journal_mode = WAL");
    this.db.pragma("wal_autocheckpoint = 1000");
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("busy_timeout = 5000");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("temp_store = MEMORY");
    this.db.pragma("mmap_size = 134217728");
    this.db.pragma("cache_size = -2000");
    this.startOptimizeTimer();
  }

  public async close(): Promise<void> {
    if (this.optimizeTimer) {
      clearInterval(this.optimizeTimer);
      this.optimizeTimer = undefined;
    }
    if (this.db) {
      if (this.transactionDepth > 0) {
        this.db.exec("ROLLBACK");
        this.transactionDepth = 0;
        this.savepointStack = [];
      }
      this.db.pragma("optimize");
      this.db.close();
      this.db = undefined;
    }
  }

  public async query(
    query: string,
    params?: Record<string, any>,
  ): Promise<any> {
    if (!this.db) {
      this.Logger.warn("DB is not initialized!");
      return;
    }
    return this.db.prepare(query).all(params);
  }

  public async execute(
    query: string,
    params?: Record<string, any>,
  ): Promise<DBResult> {
    if (!this.db) {
      this.Logger.warn("DB is not initialized!");
      return {};
    }
    const result = this.db.prepare(query).run(params);
    return {
      // better-sqlite3 returns bigint for lastInsertRowid
      lastInsertId: result.lastInsertRowid,
      affectedRows: result.changes,
    };
  }

  public async beginTransaction(): Promise<void> {
    if (!this.db) {
      this.Logger.warn("DB is not initialized!");
      return;
    }
    if (this.transactionDepth === 0) {
      this.db.exec("BEGIN");
    } else {
      const spName = `sp_${randomUUID().substring(0, 8)}`;
      this.db.exec(`SAVEPOINT ${spName}`);
      this.savepointStack.push(spName);
    }
    this.transactionDepth++;
  }

  public async commit(): Promise<void> {
    if (!this.db || this.transactionDepth === 0) {
      this.Logger.warn("No active transaction!");
      return;
    }
    this.transactionDepth--;
    if (this.transactionDepth === 0) {
      this.db.exec("COMMIT");
      this.savepointStack = [];
    } else {
      const spName = this.savepointStack.pop()!;
      this.db.exec(`RELEASE SAVEPOINT ${spName}`);
    }
  }

  public async rollback(): Promise<void> {
    if (!this.db || this.transactionDepth === 0) {
      this.Logger.warn("No active transaction!");
      return;
    }
    this.transactionDepth--;
    if (this.transactionDepth === 0) {
      this.db.exec("ROLLBACK");
      this.savepointStack = [];
    } else {
      const spName = this.savepointStack.pop()!;
      this.db.exec(`ROLLBACK TO SAVEPOINT ${spName}`);
    }
  }

  private startOptimizeTimer(): void {
    this.optimizeTimer = setInterval(
      () => {
        if (this.db && this.transactionDepth === 0) {
          try {
            this.db.pragma("optimize");
          } catch (e) {
            this.Logger.warn(`optimize failed: ${e}`);
          }
        }
      },
      30 * 60 * 1000,
    );
  }

  public buildUpsertQuery(
    table: string,
    data: Record<string, any>,
    uniqueKey: string,
  ): { query: string; params: Record<string, any> } {
    const keys = Object.keys(data);
    const updates = keys
      .filter((k) => k !== uniqueKey)
      .map((k) => `${k} = :${k}`)
      .join(", ");
    const placeholders = keys.map((k) => `:${k}`).join(", ");
    const query = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${uniqueKey}) DO UPDATE SET ${updates}`;
    return { query, params: data };
  }

  public buildReplaceOneQuery(
    table: string,
    data: Record<string, any>,
  ): { query: string; params: Record<string, any> } {
    const keys = Object.keys(data);
    const placeholders = keys.map((k) => `:${k}`).join(", ");
    // SQLite also supports REPLACE INTO
    const query = `REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
    return { query, params: data };
  }

  public getListTablesQuery(): string {
    return `SELECT name FROM sqlite_master WHERE type='table'`;
  }

  public mapSchemaTypeToSQL(type: SchemaType): string {
    // SQLite has a more flexible type system, but we can map to common affinities.
    switch (type) {
      case SchemaType.integer:
      case SchemaType.bigint:
      case SchemaType.boolean:
        return "INTEGER";
      case SchemaType.float:
      case SchemaType.double:
      case SchemaType.decimal:
        return "REAL";
      case SchemaType.binary:
      case SchemaType.blob:
        return "BLOB";
      default:
        return "TEXT"; // string, text, json, date, time, uuid etc.
    }
  }
}
