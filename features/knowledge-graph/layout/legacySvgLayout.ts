import {
  getVisibleProjection,
  knowledgeNodes,
  type KnowledgeNode,
} from "../model/knowledgeViewModel";

export type Viewport = { x: number; y: number; scale: number };
export type TraceMode = "context" | "upstream" | "downstream" | "all";
export type PositionedNode = KnowledgeNode & {
  x: number;
  y: number;
  role: "previous" | "focus" | "next";
};

export const WORLD = { width: 1100, height: 680 };
export const NODE_W = 252;
export const NODE_H = 64;

export const nodeMap = new Map(knowledgeNodes.map((node) => [node.id, node]));
export const childrenMap = new Map<string, KnowledgeNode[]>();

knowledgeNodes.forEach((node) => {
  if (!node.parent) return;
  childrenMap.set(node.parent, [...(childrenMap.get(node.parent) ?? []), node]);
});

export function ancestorsOf(id: string) {
  const result: KnowledgeNode[] = [];
  let current = nodeMap.get(id);
  while (current?.parent) {
    const parent = nodeMap.get(current.parent);
    if (!parent) break;
    result.push(parent);
    current = parent;
  }
  return result;
}

export function descendantsOf(id: string) {
  const result = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    (childrenMap.get(current) ?? []).forEach((node) => {
      if (!result.has(node.id)) {
        result.add(node.id);
        queue.push(node.id);
      }
    });
  }
  return result;
}

export function arrange(focus: KnowledgeNode): PositionedNode[] {
  const projection = getVisibleProjection(focus.id);
  const projectedNext = projection.next
    .map((node) => nodeMap.get(node.id))
    .filter((node): node is KnowledgeNode => Boolean(node));
  const children = projectedNext.length ? projectedNext : childrenMap.get(focus.id) ?? [];
  const ancestors = ancestorsOf(focus.id);
  const centerY = WORLD.height / 2 - NODE_H / 2;
  const result: PositionedNode[] = [];

  if (children.length) {
    if (ancestors[0]) {
      result.push({ ...ancestors[0], x: 48, y: centerY, role: "previous" });
    }
    const focusX = ancestors[0] ? 374 : 92;
    const childX = ancestors[0] ? 744 : 500;
    result.push({ ...focus, x: focusX, y: centerY, role: "focus" });
    const gap = Math.min(82, 550 / Math.max(1, children.length - 1));
    const start = centerY - ((children.length - 1) * gap) / 2;
    children.forEach((node, index) => {
      result.push({ ...node, x: childX, y: start + index * gap, role: "next" });
    });
  } else {
    const trail = [...ancestors].reverse().slice(-2);
    const columns = trail.length === 2 ? [48, 374, 744] : trail.length === 1 ? [210, 590] : [424];
    [...trail, focus].forEach((node, index) => {
      result.push({
        ...node,
        x: columns[index],
        y: centerY,
        role: index === trail.length ? "focus" : "previous",
      });
    });
  }

  return result;
}

export function edgePath(from: PositionedNode, to: PositionedNode) {
  const sx = from.x + NODE_W;
  const sy = from.y + NODE_H / 2;
  const tx = to.x;
  const ty = to.y + NODE_H / 2;
  const bend = Math.max(65, (tx - sx) * 0.5);
  return `M${sx} ${sy} C${sx + bend} ${sy},${tx - bend} ${ty},${tx} ${ty}`;
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function bounded(view: Viewport, anchor?: PositionedNode): Viewport {
  const scale = Number.isFinite(view.scale) ? clamp(view.scale, 0.78, 1.42) : 1;
  const point = anchor ?? {
    x: WORLD.width / 2 - NODE_W / 2,
    y: WORLD.height / 2 - NODE_H / 2,
  };
  const anchorX = (point.x + NODE_W / 2) * scale;
  const anchorY = (point.y + NODE_H / 2) * scale;
  const marginX = NODE_W * 0.62;
  const marginY = NODE_H;
  return {
    scale,
    x: Number.isFinite(view.x)
      ? clamp(view.x, marginX - anchorX, WORLD.width - marginX - anchorX)
      : 0,
    y: Number.isFinite(view.y)
      ? clamp(view.y, marginY - anchorY, WORLD.height - marginY - anchorY)
      : 0,
  };
}
