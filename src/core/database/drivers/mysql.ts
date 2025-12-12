import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import { getCustomCoreLogger } from "../../logger.js";
import type { DB as DBConfigT } from "../../../types/config.js";
import { DBDriver } from "../../../types/abstract/database.abc.js";
import { type DBResult } from "../../../types/database.js";
import type { Logger } from "@logtape/logtape";
import { SchemaType } from "../../../types/database.js";

export class MySQLDriver implements DBDriver {
  private Logger: Logger;

  private Pool: mysql.Pool | undefined;
  private conn: mysql.PoolConnection | undefined;
  private config: Extract<DBConfigT, { type: "mysql" }>;
  private transactionDepth = 0;
  private savepointStack: string[] = [];

  constructor(c: Extract<DBConfigT, { type: "mysql" }>) {
    this.config = c;
    this.Logger = getCustomCoreLogger(["database", c.id]);
  }

  public async connect(): Promise<void> {
    if (this.Pool) return;
    const { mysql: config } = this.config;
    const isSocket =
      config.host.startsWith("unix://") || config.host.startsWith("uds://");
    this.Pool = mysql.createPool({
      ...(isSocket
        ? { socketPath: config.host }
        : { host: config.host, port: config.port ?? 3306 }),
      user: config.user,
      password: config.password,
      database: config.database,
      connectionLimit: config.pools ?? 3,
      namedPlaceholders: true,
    });
  }

  public async close(): Promise<void> {
    if (this.conn) {
      if (this.transactionDepth > 0) {
        await this.conn.rollback();
        this.transactionDepth = 0;
        this.savepointStack = [];
      }
      this.conn.release();
      this.conn = undefined;
    }
    if (this.Pool) {
      await this.Pool.end();
      this.Pool = undefined;
    }
  }

  private async getTransactedConnection(): Promise<mysql.PoolConnection> {
    if (!this.Pool) throw new Error("Pool not initialized");
    if (!this.conn) {
      this.conn = await this.Pool.getConnection();
    }
    return this.conn;
  }

  public async execute(
    query: string,
    params?: Record<string, any>,
  ): Promise<DBResult> {
    if (!this.Pool) {
      this.Logger.warn("Pool is not initialized!");
      return {};
    }
    const executor = this.conn ?? this.Pool;
    const [result] = await executor.execute(query, params);
    if (this.conn) {
      return {
        lastInsertId: (result as mysql.ResultSetHeader).insertId,
        affectedRows: (result as mysql.ResultSetHeader).affectedRows,
      };
    }
    return {
      lastInsertId: (result as mysql.ResultSetHeader).insertId,
      affectedRows: (result as mysql.ResultSetHeader).affectedRows,
    };
  }

  public async query(
    query: string,
    params?: Record<string, any>,
  ): Promise<any> {
    if (!this.Pool) {
      this.Logger.warn("Pool is not initialized!");
      return;
    }
    if (this.conn) {
      return await this.conn.query(query, params);
    }
    const [rows] = await this.Pool.query(query, params);
    return rows;
  }

  public async beginTransaction(): Promise<void> {
    const conn = await this.getTransactedConnection();
    if (this.transactionDepth === 0) {
      await conn.beginTransaction();
    } else {
      const spName = `sp_${randomUUID().substring(0, 8)}`;
      await conn.query(`SAVEPOINT ${spName}`);
      this.savepointStack.push(spName);
    }
    this.transactionDepth++;
  }

  public async commit(): Promise<void> {
    if (!this.conn || this.transactionDepth === 0) {
      this.Logger.warn("No active transaction!");
      return;
    }
    this.transactionDepth--;
    if (this.transactionDepth === 0) {
      await this.conn.commit();
      this.conn.release();
      this.conn = undefined;
      this.savepointStack = [];
    } else {
      const spName = this.savepointStack.pop()!;
      await this.conn.query(`RELEASE SAVEPOINT ${spName}`);
    }
  }

  public async rollback(): Promise<void> {
    if (!this.conn || this.transactionDepth === 0) {
      this.Logger.warn("No active transaction!");
      return;
    }
    this.transactionDepth--;
    if (this.transactionDepth === 0) {
      await this.conn.rollback();
      this.conn.release();
      this.conn = undefined;
      this.savepointStack = [];
    } else {
      const spName = this.savepointStack.pop()!;
      await this.conn.query(`ROLLBACK TO SAVEPOINT ${spName}`);
    }
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
    const query = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
    return { query, params: data };
  }

  public buildReplaceOneQuery(
    table: string,
    data: Record<string, any>,
  ): { query: string; params: Record<string, any> } {
    const keys = Object.keys(data);
    const placeholders = keys.map((k) => `:${k}`).join(", ");
    const query = `REPLACE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
    return { query, params: data };
  }

  public getListTablesQuery(): string {
    return `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
  }

  public mapSchemaTypeToSQL(type: SchemaType): string {
    switch (type) {
      case SchemaType.string:
        return "VARCHAR(255)";
      case SchemaType.integer:
        return "INT";
      case SchemaType.bigint:
        return "BIGINT";
      case SchemaType.boolean:
        return "BOOLEAN";
      case SchemaType.text:
        return "TEXT";
      case SchemaType.float:
        return "FLOAT";
      case SchemaType.double:
        return "DOUBLE";
      case SchemaType.json:
        return "JSON";
      case SchemaType.date:
        return "DATE";
      case SchemaType.timestamp:
        return "TIMESTAMP";
      case SchemaType.datetime:
        return "DATETIME";
      case SchemaType.time:
        return "TIME";
      case SchemaType.decimal:
        return "DECIMAL(10,2)";
      case SchemaType.binary:
        return "BINARY";
      case SchemaType.blob:
        return "BLOB";
      case SchemaType.uuid:
        return "CHAR(36)";
      case SchemaType.varchar:
        return "VARCHAR(255)";
      case SchemaType.char:
        return "CHAR";
      default:
        return "TEXT";
    }
  }
}
