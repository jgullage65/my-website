import type { KnowledgeObservation } from "../routing/contracts";
import type { BucketReport } from "../specialists/contracts";

export type BucketShadowDiagnostics = {
  observations: KnowledgeObservation[];
  reports: BucketReport[];
};
