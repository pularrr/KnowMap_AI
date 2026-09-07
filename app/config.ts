import { ACTIVE_PROFILE } from "../profiles/active";

export const APP_CONFIG = {
  appName: ACTIVE_PROFILE.name,
  appSubtitle: ACTIVE_PROFILE.description,
  rootNodeId: ACTIVE_PROFILE.initialization.rootNode.id,
  storagePrefix: "knowmap",
  eyebrow: "KNOWMAP · KNOWLEDGE GRAPH",
} as const;
