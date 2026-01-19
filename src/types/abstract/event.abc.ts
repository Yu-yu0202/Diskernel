import type { Client } from "discord.js";

export abstract class Event {
  static async initalize(_client: Client<boolean>): Promise<void> {}
}
