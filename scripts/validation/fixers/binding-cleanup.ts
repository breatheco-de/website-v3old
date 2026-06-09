import type { Fixer, FixerContext, FixerResult } from "./types";
import { bindingManager } from "../../../server/bindings";

export const bindingCleanupFixer: Fixer = {
  name: "binding-cleanup",
  description: "Removes stale section-binding references that point to deleted or moved sections",

  async run(_ctx: FixerContext): Promise<FixerResult> {
    const removed = bindingManager.cleanupStaleReferences(false);

    return {
      ok: true,
      message:
        removed > 0
          ? `Removed ${removed} stale binding reference${removed !== 1 ? "s" : ""}`
          : "No stale binding references found",
      details: { removedCount: removed },
    };
  },
};
