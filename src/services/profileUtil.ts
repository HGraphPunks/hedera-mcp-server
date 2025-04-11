// src/services/profileUtil.ts
import { AccountId } from "@hashgraph/sdk";
import type { PrivateKey } from "@hashgraph/sdk";

// (This could include validation or structuring logic, but here it's straightforward JSON conversion.)
export function profileToMemo(profile: object): string {
    return JSON.stringify(profile);
}
