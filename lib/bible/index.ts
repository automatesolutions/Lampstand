import "server-only";
import type { BibleProvider } from "./provider";
import type { VersionId } from "./types";
import { kjvLocal } from "./providers/kjv-local";
import { esvApi } from "./providers/esv-api";
import { nltApi } from "./providers/nlt-api";

// Licensed versions register here once their provider exists.
const providers: Partial<Record<VersionId, BibleProvider>> = {
  KJV: kjvLocal,
  NLT: nltApi,
  ESV: esvApi,
};

export function getProvider(id: VersionId): BibleProvider | undefined {
  return providers[id];
}
