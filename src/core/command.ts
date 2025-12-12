import path from "path";
import fs from "fs";
import {
  ApplicationCommandType,
  Client,
  ContextMenuCommandBuilder,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  EmbedBuilder,
  type ApplicationCommandDataResolvable,
  type Guild,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
} from "discord.js";
import { Core } from "./client.js";
import { Config } from "./config.js";
import { getCustomCoreLogger } from "./logger.js";
import {
  type CommandT,
  type OptionT,
  type CooldownData,
  Command as command,
} from "#types";

type AnyCommandT = CommandT<"slash", undefined> | CommandT<"context", "User" | "Message">;

const Logger = getCustomCoreLogger("commands");

export class Command extends command {
  private static client?: Client;
  private static commands: AnyCommandT[];
  private static subCommands: {
    parent: string;
    command: SlashCommandSubcommandBuilder;
  }[] = [];
  private static cooldown: Map<string, CooldownData> = new Map<
    string,
    CooldownData
  >();

  public static async initialize(): Promise<void> {
    this.commands = [];
    this.subCommands = [];
    this.cooldown = new Map<string, CooldownData>();

    this.client = Core.Client;

    await this.registerCommands();
    this.client?.on("interactionCreate", (interaction) => {
      if (
        interaction.isChatInputCommand() ||
        interaction.isContextMenuCommand() ||
        interaction.isAutocomplete()
      )
        this.handleCommands(interaction);
    });
    this.client?.on("guildCreate",async (guild) => {
      Logger.info(`✅ Joined new guild(id: ${guild.id}, name: ${guild.name}). registering commands...`);
      const commands = (() => {
        try {
          return this.buildCommands();
        } catch (e: unknown) {
          Logger.error(`❌️ Failed to build commands: ${(e as Error).message}`);
          Logger.error(`Stack trace: ${(e as Error).stack}`);
          return undefined;
        }
      })();
      if(commands) await this.registerWithGuildID(guild.id,commands);
      Logger.info('✅ Register commands finished successfully.');
    });
  }

  private static async loadCommandFromDir(dir: string): Promise<boolean> {
    try {
      const files = await fs.promises.readdir(dir);
      await Promise.all(
        files
          .filter((f) => f.endsWith(".js"))
          .map(async (file) => {
            const filePath = path.join(dir, file);
            try {
              const module = await import(filePath);
              let command: any = Object.values(module)[0];

              if (command && typeof command === "function" && command.prototype) {
                try {
                  command = new command() as AnyCommandT;
                } catch (_e) {
                  Logger.warn(`❌️ Failed to instantiate command class: ${file}`);
                  return;
                }
              }

              if (
                !command ||
                typeof command.name !== "string" ||
                (command.type !== "slash" && command.type !== "context") ||
                typeof command.execute !== "function"
              ) {
                Logger.warn(`❌️ Invalid command: ${file}`);
                return;
              }

              command.isCooldownEnabled ??= false;
              command.description ??= "No description provided.";

              if (command.isAdminOnly) {
                if (!Config.get("options")?.feature.enableAdminCommands) {
                  Logger.warn(`❌️ Admin command is disabled: ${file}`);
                  return;
                }
                if (!Config.get("options")?.adminIds) {
                  Logger.warn(
                    `❌️ Admin command is disabled due to no admin IDs in configuration: ${file}`,
                  );
                  return;
                }
              }
              if (command.isDevOnly) {
                if (
                  !Config.get("options")?.feature.enableDevelopmentCommands
                ) {
                  Logger.warn(`❌️ Development command is disabled: ${file}`);
                  return;
                }
              }

              this.commands.push(command);
              Logger.debug(`✅️ Loaded command: ${file}`);
            } catch {
              Logger.warn(`❌️ Failed to import command: ${file}`);
            }
          }),
      );
      return true;
    } catch {
      Logger.warn(`⚠ Command folder does not exist: ${dir}`);
      return false;
    }
  }

  private static buildCommandOptions(
    option: OptionT,
    command: SlashCommandBuilder | SlashCommandSubcommandBuilder,
  ) {
    switch (option.type) {
      case "string":
        command.addStringOption((option) =>
          option
            .setName(option.name)
            .setDescription(option.description)
            .setRequired(option.required)
            .addChoices(option.choices ?? []),
        );
        break;
      case "integer":
        command.addIntegerOption((option) =>
          option
            .setName(option.name)
            .setDescription(option.description)
            .setRequired(option.required)
            .addChoices(option.choices ?? []),
        );
        break;
      case "boolean":
        command.addBooleanOption((option) =>
          option
            .setName(option.name)
            .setDescription(option.description)
            .setRequired(option.required),
        );
        break;
      case "channel":
        command.addChannelOption((option) =>
          option
            .setName(option.name)
            .setDescription(option.description)
            .setRequired(option.required),
        );
        break;
      case "role":
        command.addRoleOption((option) =>
          option
            .setName(option.name)
            .setDescription(option.description)
            .setRequired(option.required),
        );
        break;
      case "user":
        command.addUserOption((option) =>
          option
            .setName(option.name)
            .setDescription(option.description)
            .setRequired(option.required),
        );
        break;
    }
  }

  private static initializeCooldown(
    name: string,
    globalCooldownTime?: number,
    userCooldownTime?: number,
  ): void {
    this.cooldown.set(name, {
      globalCooldownTime,
      userCooldownTime,
      lastUsedGlobal: undefined,
      user: new Map<string, number>(),
    });
    return undefined;
  }

  private static buildCommands(): ApplicationCommandDataResolvable[] {
    type _commands = SlashCommandBuilder | ContextMenuCommandBuilder;
    const commands: _commands[] = [];

    for (const command of this.commands) {
      if (command.type === "slash" && !command.parent) {
        const slashCommand = new SlashCommandBuilder()
          .setName(command.name)
          .setDescription(command.description);
        if (command.option) {
          for (const option of command.option) {
            this.buildCommandOptions(option, slashCommand);
          }
        }
        commands.push(slashCommand);
      } else if (command.type === "slash" && command.parent) {
        const subCommand = new SlashCommandSubcommandBuilder()
          .setName(command.name)
          .setDescription(command.description);
        if (command.option) {
          for (const option of command.option) {
            this.buildCommandOptions(option, subCommand);
          }
        }
        this.subCommands.push({ parent: command.parent, command: subCommand });
      } else if (command.type === "context") {
        const contextMenuCommand = new ContextMenuCommandBuilder()
          .setName(command.name)
          .setType(
            command.contextMenuType === "User"
              ? ApplicationCommandType.User
              : ApplicationCommandType.Message,
          );
        commands.push(contextMenuCommand);
      }
      if (command.isCooldownEnabled) {
        this.initializeCooldown(
          command.name,
          command.globalCooldownTime,
          command.userCooldownTime,
        );
      }
      this.subCommands.forEach((v) => {
        const slashCommand = commands.find((c) => c.name === v.parent);
        if (slashCommand instanceof SlashCommandBuilder) {
          slashCommand.addSubcommand(v.command);
        }
      });
    }
    return commands.map((c) => {
      return c.toJSON();
    });
  }

  private static buildSubCommandFromNameAndParent(
    name: string,
    parent: string,
  ): boolean {
    const parentCommand = this.commands.find((c) => c.name === parent);
    if (!parentCommand) return false;

    const command = this.commands.find(
      (c) => c.name === name && c.parent === parent,
    );
    if (!command) return false;

    const subCommand = new SlashCommandSubcommandBuilder()
      .setName(command.name)
      .setDescription(command.description);
    if (command.option) {
      for (const option of command.option) {
        this.buildCommandOptions(option, subCommand);
      }
    }
    if (command.isCooldownEnabled) {
      this.initializeCooldown(
        command.name,
        command.globalCooldownTime,
        command.userCooldownTime,
      );
    }
    this.subCommands.push({ parent: command.parent!, command: subCommand });

    return true;
  }

  private static buildCommandFromName(
    name: string,
  ): SlashCommandBuilder | ContextMenuCommandBuilder | undefined {
    const command = this.commands.find((c) => c.name === name);
    if (!command) return undefined;

    if (command.isCooldownEnabled) {
      this.initializeCooldown(
        command.name,
        command.globalCooldownTime,
        command.userCooldownTime,
      );
    }
    if (command.parent && command.type === "slash") {
      const parent = this.buildCommandFromName(command.parent);
      if (!(parent instanceof SlashCommandBuilder)) return undefined;

      if (this.buildSubCommandFromNameAndParent(name, parent.name)) {
        this.subCommands
          .filter((c) => c.parent === parent.name)
          .forEach((c) => {
            parent.addSubcommand(c.command);
          });
        return parent;
      } else return undefined;
    } else if (command.type === "slash") {
      const slashCommand = new SlashCommandBuilder()
        .setName(command.name)
        .setDescription(command.description);
      if (command.option) {
        for (const option of command.option) {
          this.buildCommandOptions(option, slashCommand);
        }
      }
      return slashCommand;
    } else if (command.type === "context") {
      const contextMenuCommand = new ContextMenuCommandBuilder()
        .setName(command.name)
        .setType(
          command.contextMenuType === "User"
            ? ApplicationCommandType.User
            : ApplicationCommandType.Message,
        );
      return contextMenuCommand;
    }
  }

  private static async registerWithGuildID(
    guildID: string,
    commands: ApplicationCommandDataResolvable[],
  ): Promise<boolean> {
    const guild: Guild | undefined = this.client!.guilds.cache.get(guildID);
    if (!guild) {
      Logger.warn(`⚠ Guild with ID ${guildID} not found.`);
      return false;
    }
    await guild.commands.set(commands).catch((e: Error) => {
      Logger.error(
        `❌️ Failed to register commands for guild ${guildID}: ${e.message}`,
      );
      return false;
    });
    Logger.debug(
      `✅ Registered ${commands.length} commands for guild ${guildID}.`,
    );
    return true;
  }

  public static async unregisterFromName(name: string): Promise<boolean> {
    const command = (await this.client!.application?.commands.fetch())?.find(
      (c) => c.name === name,
    );
    if (!command) {
      Logger.warn(`⚠ Command with name ${name} not found.`);
      return false;
    }

    const guilds = this.client!.guilds.cache.values();
    for (const guild of guilds) {
      await guild.commands.delete(command);
      if (guilds.toArray().length < 10) {
        setTimeout(() => { }, 1000);
      }
    }

    return true;
  }

  public static async unregisterFromNameAndGuildID(
    name: string,
    guildID: string,
  ): Promise<boolean> {
    const Command = (
      await this.client!.guilds.cache.get(guildID)?.commands.fetch()
    )?.find((c) => c.name === name);
    if (!Command) {
      Logger.warn(`⚠ Command with name ${name} not found in guild ${guildID}.`);
      return false;
    }

    await this.client!.guilds.cache.get(guildID)?.commands.delete(Command);
    return true;
  }

  public static async registerFromName(name: string): Promise<boolean> {
    const commands = await this.client!.application?.commands.fetch();
    if (commands?.find((c) => c.name === name)) {
      Logger.warn(`⚠ Command with name ${name} already exists.`);
      return false;
    }
    const command = this.buildCommandFromName(name)?.toJSON();
    if (!command) {
      Logger.warn(`⚠ Command with name ${name} is invalid.`);
      return false;
    }
    const guilds = this.client!.guilds.cache.values();
    for (const guild of guilds) {
      await guild.commands.create(command);
      if (guilds.toArray().length < 10) {
        setTimeout(() => { }, 1000);
      }
    }
    return true;
  }

  public static async registerFromNameAndGuildID(
    name: string,
    guildID: string,
  ): Promise<boolean> {
    if (
      (await this.client!.application?.commands.fetch())?.find(
        (c) => c.name === name,
      )
    ) {
      Logger.warn(
        `⚠ Command with name ${name} already exists in GuildID ${guildID}.`,
      );
      return false;
    }
    const command = this.buildCommandFromName(name)?.toJSON();
    if (!command) {
      Logger.warn(`⚠ Command with name ${name} is invalid.`);
      return false;
    }
    const guild = this.client!.guilds.cache.get(guildID);
    if (!guild) {
      Logger.warn(`⚠ Guild with ID ${guildID} not found.`);
      return false;
    }

    await guild.commands.create(command);
    return true;
  }

  private static async registerCommands(): Promise<boolean> {
    if (
      !(await this.loadCommandFromDir(path.resolve(process.cwd(), "dist", "commands")))
    ) {
      Logger.warn(`❌️ Failed to load commands from ${process.cwd()}/dist/commands`);
      return false;
    }
    Logger.info(`✅️ Loaded ${this.commands.length} commands.`);

    const commands = (() => {
      try {
        return this.buildCommands();
      } catch (e: unknown) {
        Logger.error(`❌️ Failed to build commands: ${(e as Error).message}`);
        Logger.error(`Stack trace: ${(e as Error).stack}`);
        return undefined;
      }
    })();
    if (!commands) return false;

    const guilds = this.client!.guilds.cache.values();
    for (const guild of guilds) {
      await this.registerWithGuildID(guild.id, commands);
      if (guilds.toArray().length < 10) {
        setTimeout(() => { }, 1000);
      }
    }

    Logger.info(`✅️ Registered ${commands.length} commands successfully.`);
    return true;
  }

  private static isCooldownPassed(name: string, userid: string): boolean {
    if (!this.cooldown.has(name)) return true;
    const command = this.cooldown.get(name)!;

    const now = Date.now();
    const isAdmin = Config.get("options")?.adminIds?.includes(userid);

    if (command.globalCooldownTime) {
      if (
        !isAdmin &&
        command.lastUsedGlobal &&
        now < command.lastUsedGlobal + command.globalCooldownTime!
      ) {
        return false;
      }
      command.lastUsedGlobal = now;
    }

    if (command.userCooldownTime && !isAdmin) {
      if (!command.user) {
        command.user = new Map<string, number>();
      }
      if (
        command.user.has(userid) &&
        now < command.user.get(userid)! + command.userCooldownTime!
      ) {
        return false;
      }
      command.user.set(userid, now);
    }

    return true;
  }

  private static isPrivilegeCheckPassed(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
  ): boolean {
    const command = this.commands.find(
      (c) => c.name === interaction.commandName,
    );
    if (!command) return false;

    if (!command.isAdminOnly) return true;

    if (!Config.get("options").feature.enableAdminCommands) return false;
    if (!Config.get("options").adminIds?.includes(interaction.user.id))
      return false;

    return true;
  }

  private static isDevCheckPassed(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
  ): boolean {
    const command = this.commands.find(
      (c) => c.name === interaction.commandName,
    );
    if (!command) return false;

    if (!command.isDevOnly) return true;

    if (!Config.get("options").feature.enableDevelopmentCommands) return false;
    if (!Config.get("options").adminIds?.includes(interaction.user.id))
      return false;

    return true;
  }

  private static async replyCooldownMessage(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("⏳️ レート制限")
      .setDescription(
        "このコマンドにはレート制限があります。少し待ってからもう一度実行してください。\n-# 高頻度でコマンドを実行する行為はおやめください。",
      )
      .setColor("Red");
    await interaction.reply({ embeds: [embed], ephemeral: true }).catch((e) => {
      Logger.warn(
        `❌️ Failed to reply to ${interaction.commandName} cooldown message. Error: ${e.message}`,
      );
    });
    return;
  }

  private static async replyPrivilegeMessage(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("❌️ 管理者権限が必要です")
      .setDescription("このコマンドは管理者権限が必要です。")
      .setColor("Red");
    await interaction.reply({ embeds: [embed], ephemeral: true }).catch((e) => {
      Logger.warn(
        `❌️ Failed to reply to ${interaction.commandName} privilege message. Error: ${e.message}`,
      );
    });
    return;
  }

  private static async replyDevMessage(
    interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction,
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("❌️ 管理者権限が必要です")
      .setDescription(
        "このコマンドは開発環境専用として構成されています。\n実行するには管理者権限が必要です。",
      )
      .setColor("Red");
    await interaction.reply({ embeds: [embed], ephemeral: true }).catch((e) => {
      Logger.warn(
        `❌️ Failed to reply to ${interaction.commandName} dev message. Error: ${e.message}`,
      );
    });
    return;
  }

  private static async handleCommands(
    interaction:
      | ChatInputCommandInteraction
      | ContextMenuCommandInteraction
      | AutocompleteInteraction,
  ): Promise<void> {
    Logger.debug(
      `Triggered command-interaction: ${interaction.commandName} for ${interaction.user.id}(${interaction.user.globalName})`,
    );
    const command = this.commands.find(
      (c) => c.name === interaction.commandName,
    );
    if (!command) {
      Logger.debug(
        `❌️ Command with name ${interaction.commandName} not found.`,
      );
      return;
    }

    if (interaction instanceof AutocompleteInteraction) {
      if (command.autocomplete) {
        Logger.debug(
          `✅️ Triggered autocomplete for ${interaction.commandName}`,
        );
        await command.autocomplete(interaction);
      }
      return;
    }

    const isCommandTypeMatch =
      (command.type === "slash" &&
        interaction instanceof ChatInputCommandInteraction) ||
      (command.type === "context" &&
        interaction instanceof ContextMenuCommandInteraction);

    if (!isCommandTypeMatch) {
      Logger.debug(
        `❌️ Command ${interaction.commandName} is not a ${command.type} command`,
      );
      return;
    }

    if (!this.isDevCheckPassed(interaction)) {
      Logger.debug(
        `❌️ Command ${interaction.commandName} is dev only for ${interaction.user.id}(${interaction.user.globalName})`,
      );
      await this.replyDevMessage(interaction);
      return;
    }

    if (!this.isPrivilegeCheckPassed(interaction)) {
      Logger.debug(
        `❌️ Command ${interaction.commandName} is admin only for ${interaction.user.id}(${interaction.user.globalName})`,
      );
      await this.replyPrivilegeMessage(interaction);
      return;
    }

    if (!this.isCooldownPassed(command.name, interaction.user.id)) {
      Logger.debug(
        `❌️ Command ${interaction.commandName} is on cooldown for ${interaction.user.id}(${interaction.user.globalName})`,
      );
      await this.replyCooldownMessage(interaction);
      return;
    }

    Logger.debug(
      `✅️ Triggered command ${interaction.commandName} for ${interaction.user.id}(${interaction.user.globalName})`,
    );

    if (
      command.type === "slash" &&
      interaction instanceof ChatInputCommandInteraction
    ) {
      await command.execute(interaction);
    } else if (
      command.type === "context" &&
      command.contextMenuType === "User" &&
      interaction instanceof UserContextMenuCommandInteraction
    ) {
      await command.execute(interaction);
    } else if (
      command.type === "context" &&
      command.contextMenuType === "Message" &&
      interaction instanceof MessageContextMenuCommandInteraction
    ) {
      await command.execute(interaction);
    }
  }
}
