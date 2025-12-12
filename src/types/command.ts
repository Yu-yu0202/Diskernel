import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
} from "discord.js";

export interface CooldownData {
  globalCooldownTime?: number;
  userCooldownTime?: number;
  lastUsedGlobal?: number;
  user?: Map<string, number>;
}

export interface OptionT {
  name: string;
  description: string;
  type: "string" | "integer" | "boolean" | "user" | "channel" | "role";
  required: boolean;
  choices?: { name: string; value: string }[];
}

interface BaseCommand<T extends "slash" | "context"> {
  name: string;
  parent?: string;
  description: string;
  type: T;
  isAdminOnly?: boolean;
  isDevOnly?: boolean;
  isCooldownEnabled: boolean;
  globalCooldownTime?: number;
  userCooldownTime?: number;
  option?: OptionT[];
}

export type SlashCommandT = BaseCommand<"slash"> & {
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export type ContextCommandBase = BaseCommand<"context"> & {
  contextMenuType: "User" | "Message";
  autocomplete?: never;
};

export type UserContextCommandT = ContextCommandBase & {
  contextMenuType: "User";
  execute: (interaction: UserContextMenuCommandInteraction) => Promise<void>;
};

export type MessageContextCommandT = ContextCommandBase & {
  contextMenuType: "Message";
  execute: (interaction: MessageContextMenuCommandInteraction) => Promise<void>;
};

export type ContextCommandT<T extends "User" | "Message"> = T extends "User"
  ? UserContextCommandT
  : MessageContextCommandT;

export type CommandT<T extends "slash" | "context", K extends "User" | "Message" | undefined = undefined> = T extends "slash"
  ? SlashCommandT
  : ContextCommandT<T extends "context" ? K extends "User" | "Message" ? K : never : never>;