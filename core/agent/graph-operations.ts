import type {
  AgentCardRecord,
  AgentEdgeRecord,
  AgentGraphSnapshot,
  AgentNodeRecord,
  EntityDiff,
  GraphOperation,
  ProjectionDiff,
} from "./contracts";

const clone = <T>(value: T): T => structuredClone(value);

export function applyOperations(
  snapshot: AgentGraphSnapshot,
  operations: readonly GraphOperation[],
  nextRevision = snapshot.revision,
): AgentGraphSnapshot {
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, clone(node)]));
  const edges = new Map(snapshot.edges.map((edge) => [edge.id, clone(edge)]));
  const cards = new Map(snapshot.cards.map((card) => [card.nodeId, clone(card)]));

  for (const operation of operations) {
    switch (operation.kind) {
      case "upsert-node": nodes.set(operation.node.id, clone(operation.node)); break;
      case "remove-node": nodes.delete(operation.nodeId); break;
      case "upsert-edge": edges.set(operation.edge.id, clone(operation.edge)); break;
      case "remove-edge": edges.delete(operation.edgeId); break;
      case "upsert-card": cards.set(operation.card.nodeId, clone(operation.card)); break;
      case "remove-card": cards.delete(operation.nodeId); break;
    }
  }

  return {
    revision: nextRevision,
    nodes: [...nodes.values()] as AgentNodeRecord[],
    edges: [...edges.values()] as AgentEdgeRecord[],
    cards: [...cards.values()] as AgentCardRecord[],
  };
}

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

export function deterministicId(prefix: string, value: unknown): string {
  const input = stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function diffRecords<T>(
  before: readonly T[],
  after: readonly T[],
  idOf: (record: T) => string,
): EntityDiff {
  const left = new Map(before.map((record) => [idOf(record), stableJson(record)]));
  const right = new Map(after.map((record) => [idOf(record), stableJson(record)]));
  return {
    added: [...right.keys()].filter((id) => !left.has(id)).sort(),
    updated: [...right.keys()].filter((id) => left.has(id) && left.get(id) !== right.get(id)).sort(),
    removed: [...left.keys()].filter((id) => !right.has(id)).sort(),
  };
}

export function createProjectionDiff(
  before: AgentGraphSnapshot,
  after: AgentGraphSnapshot,
  currentNodeId?: string,
): ProjectionDiff {
  const nodes = diffRecords(before.nodes, after.nodes, (node) => node.id);
  const edges = diffRecords(before.edges, after.edges, (edge) => edge.id);
  const cards = diffRecords(before.cards, after.cards, (card) => card.nodeId);
  const changedNodes = [...nodes.added, ...nodes.updated];
  const edgeMap = new Map(after.edges.map((edge) => [edge.id, edge]));
  const endpoints = [...edges.added, ...edges.updated]
    .flatMap((id) => {
      const edge = edgeMap.get(id);
      return edge ? [edge.sourceId, edge.targetId] : [];
    });
  const visibleNodeIds = [...new Set([
    ...(currentNodeId ? [currentNodeId] : []),
    ...changedNodes,
    ...endpoints,
  ])].slice(0, 12);
  return { nodes, edges, cards, visibleNodeIds };
}
