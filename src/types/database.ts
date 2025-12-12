export enum SchemaType {
  string = 1 << 0,
  integer = 1 << 1,
  boolean = 1 << 2,
  text = 1 << 3,
  float = 1 << 4,
  double = 1 << 5,
  json = 1 << 6,
  date = 1 << 7,
  timestamp = 1 << 8,
  decimal = 1 << 9,
  binary = 1 << 10,
  array = 1 << 11,
  uuid = 1 << 12,
  enum = 1 << 13,
  time = 1 << 14,
  datetime = 1 << 15,
  bigint = 1 << 16,
  char = 1 << 17,
  varchar = 1 << 18,
  blob = 1 << 19,
}

export interface Schema {
  [key: string]: SchemaType;
}

export type DBResult = {
  lastInsertId?: number | bigint;
  affectedRows?: number;
};