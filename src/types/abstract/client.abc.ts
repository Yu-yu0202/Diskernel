import type { Client } from "discord.js";

export abstract class Core {
  static get Client(): Client | undefined {
    return undefined;
  }
  static async start(): Promise<void> { }
  static stop(): void { }
}
