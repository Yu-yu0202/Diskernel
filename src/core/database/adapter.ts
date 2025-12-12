import { getCustomCoreLogger } from "../logger.js";
import { MySQLDriver } from "./drivers/mysql.js";
import { SQLiteDriver } from "./drivers/sqlite.js";
import {
  type DBResult,
  type Schema,
  type DBDriver,
  type DB as DBConfigT,
  DatabaseAdapter as DBAdapter,
} from "#types";

const Logger = getCustomCoreLogger("database");

export class DatabaseAdapter extends DBAdapter {
  private readonly driver: DBDriver;
  constructor(config: DBConfigT) {
    super();
    this.driver =
      config.type === "mysql"
        ? new MySQLDriver(config)
        : new SQLiteDriver(config);
  }

  public async connect(): Promise<void> {
    await this.driver.connect();
  }

  public async close(): Promise<void> {
    await this.driver.close();
  }

  public async execute(
    query: string,
    params?: Record<string, any>,
  ): Promise<DBResult> {
    return await this.driver.execute(query, params);
  }

  public async query(
    query: string,
    params?: Record<string, any>,
  ): Promise<any | undefined> {
    return await this.driver.query(query, params);
  }

  public async beginTransaction(): Promise<void> {
    return await this.driver.beginTransaction();
  }

  public async commit(): Promise<void> {
    return await this.driver.commit();
  }

  public async rollback(): Promise<void> {
    return await this.driver.rollback();
  }

  public async insertOne(
    table: string,
    data: Record<string, any>,
  ): Promise<DBResult> {
    if (!this.validateIdentifier(table)) return {};
    const { query, params } = this.buildInsertQuery(table, data);
    return await this.driver.execute(query, params);
  }

  public async upsert(
    table: string,
    data: Record<string, any>,
    uniqueKey: string,
  ): Promise<DBResult> {
    if (!this.validateIdentifier(table) || !this.validateIdentifier(uniqueKey))
      return {};
    const { query, params } = this.driver.buildUpsertQuery(
      table,
      data,
      uniqueKey,
    );
    return await this.driver.execute(query, params);
  }

  public async replaceOne(
    table: string,
    data: Record<string, any>,
    uniqueKey: string,
  ): Promise<DBResult> {
    if (!this.validateIdentifier(table) || !this.validateIdentifier(uniqueKey))
      return {};
    const { query, params } = this.driver.buildReplaceOneQuery(table, data);
    return await this.driver.execute(query, params);
  }

  public async createTable(table: string, schema: Schema): Promise<void> {
    if (!this.validateIdentifier(table)) return;
    const columns = Object.entries(schema)
      .map(([name, type]) => {
        if (!this.validateIdentifier(name)) return null;
        return `${name} ${this.driver.mapSchemaTypeToSQL(type)}`;
      })
      .filter(Boolean)
      .join(", ");
    if (!columns) return;
    await this.driver.execute(
      `CREATE TABLE IF NOT EXISTS ${table} (${columns})`,
    );
  }

  public async dropTable(table: string): Promise<void> {
    if (!this.validateIdentifier(table)) return;
    await this.driver.execute(`DROP TABLE IF EXISTS ${table}`);
  }

  public async listTables(): Promise<string[]> {
    const query = this.driver.getListTablesQuery();
    const rows: any[] = (await this.driver.query(query)) ?? [];
    return rows.map((r: any) => r.TABLE_NAME ?? r.name);
  }

  private buildInsertQuery(table: string, data: Record<string, any>) {
    const keys = Object.keys(data);
    const placeholders = keys.map((k) => `:${k}`).join(", ");
    const query = `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`;
    return { query, params: data };
  }

  private validateIdentifier(identifier: string): boolean {
    if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
      Logger.warn(
        `Invalid identifier used: ${identifier}. Only alphanumeric characters and underscores are allowed.`,
      );
      return false;
    }
    return true;
  }
}
