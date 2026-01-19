import type { ClientEvents } from "discord.js";

export interface EventT<K extends keyof ClientEvents = keyof ClientEvents> {
  event: K;
  once?: boolean;

  execute: (...args: ClientEvents[K]) => Promise<void> | void;
}
