import type { SchemaType, DBResult, Schema } from "#types";

export abstract class DBBase {
  abstract connect(): Promise<void>;
  abstract close(): Promise<void>;
  abstract query(
    query: string,
    params?: Record<string, any>,
  ): Promise<any | undefined>;
  abstract execute(
    query: string,
    params?: Record<string, any>,
  ): Promise<DBResult>;
  abstract beginTransaction(): Promise<void>;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;
}

export abstract class DBDriver extends DBBase {
  abstract buildUpsertQuery(
    table: string,
    data: Record<string, any>,
    uniqueKey: string,
  ): { query: string; params: Record<string, any> };
  abstract buildReplaceOneQuery(
    table: string,
    data: Record<string, any>,
  ): { query: string; params: Record<string, any> };
  abstract getListTablesQuery(): string;
  abstract mapSchemaTypeToSQL(type: SchemaType): string;
}

export abstract class DatabaseConstructor {
  static initialize(): void {
    return;
  }
  static getConn(_id: string): DatabaseAdapter | undefined {
    return undefined;
  }
}

export abstract class DatabaseAdapter extends DBBase {
  abstract connect(): Promise<void>;
  abstract close(): Promise<void>;
  abstract execute(
    query: string,
    params?: Record<string, any>,
  ): Promise<DBResult>;
  abstract query(
    query: string,
    params?: Record<string, any>,
  ): Promise<any | undefined>;
  abstract beginTransaction(): Promise<void>;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;
  abstract insertOne(
    table: string,
    data: Record<string, any>,
  ): Promise<DBResult>;
  abstract upsert(
    table: string,
    data: Record<string, any>,
    uniqueKey: string,
  ): Promise<DBResult>;
  abstract createTable(table: string, schema: Schema): Promise<void>;
  abstract dropTable(table: string): Promise<void>;
  abstract listTables(): Promise<string[]>;
}
