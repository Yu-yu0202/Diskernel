export abstract class Command {
  static async initalize(): Promise<void> {}
  static async registerFromName(_name: string): Promise<boolean> {
    return false;
  }
  static async registerFromNameAndGuildID(
    _name: string,
    _guildID: string,
  ): Promise<boolean> {
    return false;
  }
  static async unregisterFromName(_name: string): Promise<boolean> {
    return false;
  }
  static async unregisterFromNameAndGuildID(
    _name: string,
    _guildID: string,
  ): Promise<boolean> {
    return false;
  }
}
