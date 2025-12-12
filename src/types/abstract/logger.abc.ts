import type { getLogger } from "@logtape/logtape";

export abstract class Log {
  static {}
  static get get(): ReturnType<typeof getLogger> {
    return {} as ReturnType<typeof getLogger>;
  }
}
