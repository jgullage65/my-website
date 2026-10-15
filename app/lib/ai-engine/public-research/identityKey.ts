import { createHmac } from "node:crypto";
import type { BusinessIdentity } from "./contracts";
/** Preserve the existing exact-input key. Different property order may miss a cache, never broaden identity. */
export const publicResearchSubjectKey = (identity: BusinessIdentity, secret: string) => createHmac("sha256",secret).update(JSON.stringify(identity)).digest("hex");
