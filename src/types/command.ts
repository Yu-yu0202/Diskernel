import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  UserContextMenuCommandInteraction,
  Interaction,
} from "discord.js";

type InteractionKind =
  | "slash"
  | "userContextMenu"
  | "messageContextMenu"
  | "button"
  | "selectMenu"
  | "modal";

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

export abstract class BaseInteraction<T extends InteractionKind> {
  protected constructor(type: T) {
    this.type = type;
  }

  readonly type: T;

  public abstract name: string;
  public description?: string;
  public global: boolean = false;
  public parent?: string;
  public option?: OptionT[];

  public abstract execute(interaction: Interaction): Promise<void>;

  public isAdminOnly: boolean = false;
  public isDevOnly: boolean = false;
  public isCooldownEnabled: boolean = false;
  public globalCooldownTime?: number;
  public userCooldownTime?: number;

  public hasParent(): this is this & { parent: string } {
    return typeof this.parent === "string";
  }

  public hasDescription(): this is this & { description: string } {
    return typeof this.description === "string";
  }

  public hasOptions(): this is this & { option: OptionT[] } {
    return Array.isArray(this.option) && this.option.length > 0;
  }

  public isUserContextCommand(): this is this & { type: "userContextMenu" } {
    return this.type === "userContextMenu";
  }

  public isMessageContextCommand(): this is this & {
    type: "messageContextMenu";
  } {
    return this.type === "messageContextMenu";
  }

  public isContextMenuCommand(): this is this & {
    type: "userContextMenu" | "messageContextMenu";
  } {
    return this.isUserContextCommand() || this.isMessageContextCommand();
  }

  public isSlashCommand(): this is this & { type: "slash" } {
    return this.type === "slash";
  }

  public isButtonAction(): this is this & { type: "button" } {
    return this.type === "button";
  }

  public isSelectMenuAction(): this is this & { type: "selectMenu" } {
    return this.type === "selectMenu";
  }

  public isModalAction(): this is this & { type: "modal" } {
    return this.type === "modal";
  }
}

export abstract class BaseCommand<
  T extends "slash" | "userContextMenu" | "messageContextMenu",
> extends BaseInteraction<T> {
  constructor(type: T) {
    super(type);
  }
}

export abstract class BaseAction<
  T extends "button" | "selectMenu" | "modal",
> extends BaseInteraction<T> {
  constructor(type: T) {
    super(type);
  }
}

export abstract class ButtonActionT extends BaseAction<"button"> {
  constructor() {
    super("button");
  }

  public abstract execute(interaction: ButtonInteraction): Promise<void>;
}

export abstract class SelectMenuActionT extends BaseAction<"selectMenu"> {
  constructor() {
    super("selectMenu");
  }

  public abstract execute(
    interaction: StringSelectMenuInteraction,
  ): Promise<void>;
}

export abstract class ModalActionT extends BaseAction<"modal"> {
  constructor() {
    super("modal");
  }

  public abstract execute(interaction: ModalSubmitInteraction): Promise<void>;
}

export abstract class SlashCommandT extends BaseCommand<"slash"> {
  constructor() {
    super("slash");
  }

  public abstract description: string;

  public async autocomplete?(
    _interaction: AutocompleteInteraction,
  ): Promise<void> {}
  public abstract execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void>;
}

export abstract class UserContextCommandT extends BaseCommand<"userContextMenu"> {
  constructor() {
    super("userContextMenu");
  }

  public abstract execute(
    interaction: UserContextMenuCommandInteraction,
  ): Promise<void>;
}

export abstract class MessageContextCommandT extends BaseCommand<"messageContextMenu"> {
  constructor() {
    super("messageContextMenu");
  }

  public abstract execute(
    interaction: MessageContextMenuCommandInteraction,
  ): Promise<void>;
}

export type CommandT<
  T extends "slash" | "context",
  K extends "User" | "Message" | undefined = undefined,
> = T extends "slash"
  ? SlashCommandT
  : K extends "User"
    ? UserContextCommandT
    : K extends "Message"
      ? MessageContextCommandT
      : never;

export type ActionT<T extends "button" | "selectMenu" | "modal"> =
  T extends "button"
    ? ButtonActionT
    : T extends "selectMenu"
      ? SelectMenuActionT
      : T extends "modal"
        ? ModalActionT
        : never;

export type AnyCommandT =
  | SlashCommandT
  | UserContextCommandT
  | MessageContextCommandT;

export type AnyActionT = ButtonActionT | SelectMenuActionT | ModalActionT;

export type AnyInteractionT = AnyCommandT | AnyActionT;
