import type { ConfigT } from "../config.js";

export abstract class Config {
  constructor() { }
  static get<K extends keyof ConfigT>(_key: K): ConfigT[K] | undefined {
    return undefined;
  }
}
