"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { branchMeta, crossLinks, formulaMeta, knowledgeNodes, type FormulaSymbol, type KnowledgeNode } from "./knowledge";

type Viewport = { x: number; y: number; scale: number };
type TraceMode = "context" | "upstream" | "downstream" | "all";
type InspectorTab = "card" | "agent";
type PositionedNode = KnowledgeNode & { x: number; y: number; role: "previous" | "focus" | "next" };

const WORLD = { width: 1100, height: 680 };
const NODE_W = 252;
const NODE_H = 64;
const nodeMap = new Map(knowledgeNodes.map((node) => [node.id, node]));
const childrenMap = new Map<string, KnowledgeNode[]>();
knowledgeNodes.forEach((node) => {
  if (!node.parent) return;
  childrenMap.set(node.parent, [...(childrenMap.get(node.parent) ?? []), node]);
});

function ancestorsOf(id: string) {
  const result: KnowledgeNode[] = [];
  let current = nodeMap.get(id);
  while (current?.parent) {
    const parent = nodeMap.get(current.parent); if (!parent) break;
    result.push(parent); current = parent;
  }
  return result;
}

function descendantsOf(id: string) {
  const result = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    (childrenMap.get(current) ?? []).forEach((node) => { if (!result.has(node.id)) { result.add(node.id); queue.push(node.id); } });
  }
  return result;
}

function arrange(focus: KnowledgeNode): PositionedNode[] {
  const children = childrenMap.get(focus.id) ?? [];
  const ancestors = ancestorsOf(focus.id);
  const centerY = WORLD.height / 2 - NODE_H / 2;
  const result: PositionedNode[] = [];
  if (children.length) {
    if (ancestors[0]) result.push({ ...ancestors[0], x: 48, y: centerY, role: "previous" });
    const focusX = ancestors[0] ? 374 : 92;
    const childX = ancestors[0] ? 744 : 500;
    result.push({ ...focus, x: focusX, y: centerY, role: "focus" });
    const gap = Math.min(82, 550 / Math.max(1, children.length - 1));
    const start = centerY - ((children.length - 1) * gap) / 2;
    children.forEach((node, index) => result.push({ ...node, x: childX, y: start + index * gap, role: "next" }));
  } else {
    const trail = [...ancestors].reverse().slice(-2);
    const columns = trail.length === 2 ? [48, 374, 744] : trail.length === 1 ? [210, 590] : [424];
    [...trail, focus].forEach((node, index) => result.push({ ...node, x: columns[index], y: centerY, role: index === trail.length ? "focus" : "previous" }));
  }
  return result;
}

function edgePath(from: PositionedNode, to: PositionedNode) {
  const sx = from.x + NODE_W, sy = from.y + NODE_H / 2, tx = to.x, ty = to.y + NODE_H / 2;
  const bend = Math.max(65, (tx - sx) * .5);
  return `M${sx} ${sy} C${sx + bend} ${sy},${tx - bend} ${ty},${tx} ${ty}`;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
function bounded(view: Viewport, anchor?: PositionedNode): Viewport {
  const scale = Number.isFinite(view.scale) ? clamp(view.scale, .78, 1.42) : 1;
  const point = anchor ?? { x: WORLD.width / 2 - NODE_W / 2, y: WORLD.height / 2 - NODE_H / 2 };
  const anchorX = (point.x + NODE_W / 2) * scale;
  const anchorY = (point.y + NODE_H / 2) * scale;
  const marginX = NODE_W * .62;
  const marginY = NODE_H;
  return {
    scale,
    x: Number.isFinite(view.x) ? clamp(view.x, marginX - anchorX, WORLD.width - marginX - anchorX) : 0,
    y: Number.isFinite(view.y) ? clamp(view.y, marginY - anchorY, WORLD.height - marginY - anchorY) : 0,
  };
}

export default function Home() {
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [focusId, setFocusId] = useState("fmcw");
  const [selectedId, setSelectedId] = useState("fmcw");
  const [traceMode, setTraceMode] = useState<TraceMode>("context");
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [dark, setDark] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("card");
  const [treeQuery, setTreeQuery] = useState("");
  const [expandedTree, setExpandedTree] = useState<Set<string>>(() => new Set(["fmcw"]));
  const [edgeFlow, setEdgeFlow] = useState(true);

  useEffect(() => { setDark(window.matchMedia("(prefers-color-scheme: dark)").matches); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stored = window.localStorage.getItem("fmcw-edge-flow");
    setEdgeFlow(!reduced && stored !== "off");
  }, []);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("node");
    if (requested && nodeMap.has(requested)) {
      setFocusId(requested);
      setSelectedId(requested);
    }
  }, []);

  const focus = nodeMap.get(focusId) ?? knowledgeNodes[0];
  const selected = nodeMap.get(selectedId) ?? focus;
  const positioned = useMemo(() => arrange(focus), [focus]);
  const positionedMap = useMemo(() => new Map(positioned.map((node) => [node.id, node])), [positioned]);
  const focusPosition = positionedMap.get(focus.id);
  const selectedAncestors = ancestorsOf(selected.id);
  const ancestorIds = new Set(selectedAncestors.map((node) => node.id));
  const descendantIds = descendantsOf(selected.id);
  const focusChildren = childrenMap.get(focus.id) ?? [];
  const selectedChildren = childrenMap.get(selected.id) ?? [];
  const treeMatches = useMemo(() => {
    const query = treeQuery.trim().toLocaleLowerCase();
    if (!query) return [];
    return knowledgeNodes.filter((node) => `${node.title} ${node.subtitle} ${node.summary}`.toLocaleLowerCase().includes(query)).slice(0, 18);
  }, [treeQuery]);

  useEffect(() => {
    setExpandedTree((previous) => new Set([...previous, focus.id, ...ancestorsOf(focus.id).map((node) => node.id)]));
  }, [focus.id]);

  const emphasized = (id: string) => traceMode === "all" || id === selected.id ||
    (traceMode === "upstream" && ancestorIds.has(id)) ||
    (traceMode === "downstream" && descendantIds.has(id)) ||
    (traceMode === "context" && (ancestorIds.has(id) || descendantIds.has(id)));

  const reveal = (id: string) => {
    const node = nodeMap.get(id); if (!node) return;
    setFocusId(id); setSelectedId(id); setViewport({ x: 0, y: 0, scale: 1 }); setTraceMode("context"); setTreeQuery("");
    const url = new URL(window.location.href); url.searchParams.set("node", id); url.hash = ""; window.history.replaceState({}, "", url);
  };
  const collapse = () => { if (focus.parent) reveal(focus.parent); };
  const zoom = (factor: number) => setViewport((value) => {
    const nextScale = clamp(value.scale * factor, .78, 1.42);
    if (!focusPosition) return bounded({ ...value, scale: nextScale });
    const focusCenterX = focusPosition.x + NODE_W / 2;
    const focusCenterY = focusPosition.y + NODE_H / 2;
    return bounded({
      scale: nextScale,
      x: value.x + focusCenterX * (value.scale - nextScale),
      y: value.y + focusCenterY * (value.scale - nextScale),
    }, focusPosition);
  });
  const endDrag = (event?: React.PointerEvent<SVGSVGElement>) => {
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const visibleEdges = positioned.flatMap((node) => {
    if (!node.parent) return [];
    const parent = positionedMap.get(node.parent);
    return parent ? [{ from: parent, to: node }] : [];
  });

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block"><div className="brand-mark" aria-hidden="true"><span /><span /><span /></div><div><div className="eyebrow">RADAR SYSTEMS · KNOWLEDGE GRAPH</div><h1>FMCW 雷达全栈知识图谱 <em>P0.4</em></h1></div></div>
        <div className="top-actions"><div className="graph-stat"><b>{knowledgeNodes.length}</b><span>具体知识节点</span></div><div className="graph-stat"><b>{Object.keys(branchMeta).length}</b><span>知识域</span></div><button className="theme-button" onClick={() => setDark((value) => !value)} aria-label={dark ? "切换为明亮主题" : "切换为暗色主题"}><span className="theme-orbit">{dark ? "☾" : "☼"}</span><span>{dark ? "暗色" : "明亮"}</span></button></div>
      </header>

      <section className="workspace" aria-label="FMCW 雷达知识图谱工作区">
        <aside className="branch-rail">
          <div className="tree-heading"><div><div className="rail-label">知识域</div><b>定位知识位置</b></div><button onClick={() => reveal(selected.id)} aria-label="定位当前知识点" title="定位当前知识点">◎</button></div>
          <label className="tree-search"><span aria-hidden="true">⌕</span><input value={treeQuery} onChange={(event) => setTreeQuery(event.target.value)} placeholder="搜索知识点…" aria-label="搜索知识点" /></label>
          <div className="domain-tree" role="tree" aria-label="知识域树">
            {treeQuery.trim() ? (
              <div className="tree-results">{treeMatches.map((node) => <button key={node.id} onClick={() => reveal(node.id)}><i style={{ background: branchMeta[node.branch].color }} /><span><b>{node.title}</b><small>{node.subtitle}</small></span></button>)}{!treeMatches.length && <p>没有匹配的知识点</p>}</div>
            ) : knowledgeNodes.filter((node) => !node.parent).map((node) => <KnowledgeTreeItem key={node.id} node={node} depth={0} focusId={focus.id} selectedId={selected.id} expanded={expandedTree} onToggle={(id) => setExpandedTree((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; })} onReveal={reveal} />)}
          </div>
        </aside>

        <div className="canvas-wrap">
          <div className="canvas-toolbar"><div className="trace-controls" role="group" aria-label="关系追踪模式">{(["context", "upstream", "downstream", "all"] as TraceMode[]).map((mode) => <button key={mode} className={traceMode === mode ? "active" : ""} onClick={() => setTraceMode(mode)}>{{ context: "关联上下文", upstream: "上游知识", downstream: "下游知识", all: "当前全部" }[mode]}</button>)}</div><div className="zoom-controls"><label className="flow-toggle" title="开启或关闭连线流动"><span>流动</span><input type="checkbox" checked={edgeFlow} onChange={(event) => { const next = event.target.checked && !window.matchMedia("(prefers-reduced-motion: reduce)").matches; setEdgeFlow(next); window.localStorage.setItem("fmcw-edge-flow", next ? "on" : "off"); }} /><i /></label><button onClick={() => zoom(1.08)} aria-label="放大">＋</button><span>{Math.round(viewport.scale * 100)}%</span><button onClick={() => zoom(.92)} aria-label="缩小">−</button><button onClick={() => setViewport({ x: 0, y: 0, scale: 1 })} aria-label="适应当前节点">⌂</button></div></div>

          <svg className="knowledge-canvas" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="渐进披露式 FMCW 雷达知识图谱"
            onWheel={(event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.06 : .94); }}
            onPointerDown={(event) => { if ((event.target as Element).closest(".node-card")) return; event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY, vx: viewport.x, vy: viewport.y }; }}
            onPointerMove={(event) => { if (!dragRef.current) return; const width = event.currentTarget.getBoundingClientRect().width; if (width < 1) return; const ratio = WORLD.width / width; setViewport((value) => bounded({ ...value, x: dragRef.current!.vx + (event.clientX - dragRef.current!.x) * ratio, y: dragRef.current!.vy + (event.clientY - dragRef.current!.y) * ratio }, focusPosition)); }}
            onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
            <defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" className="grid-line" /></pattern><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" className="arrow-head" /></marker></defs>
            <rect width={WORLD.width} height={WORLD.height} fill="url(#grid)" />
            <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
              <g className="radar-rings" transform="translate(515 340)"><circle r="115" /><circle r="220" /><circle r="330" /><path d="M0 0L300 -165" /></g>
              <g className={`edges ${edgeFlow ? "flowing" : "still"}`}>{visibleEdges.map(({ from, to }) => { const active = emphasized(from.id) && emphasized(to.id); return <path key={`${from.id}-${to.id}`} d={edgePath(from, to)} className={active ? "edge active" : "edge muted"} style={{ "--edge-color": branchMeta[to.branch].color } as React.CSSProperties} markerEnd={active ? "url(#arrow)" : undefined} />; })}{crossLinks.map((link) => { const from = positionedMap.get(link.from), to = positionedMap.get(link.to); return from && to ? <path key={`${link.from}-${link.to}`} d={edgePath(from, to)} className="edge cross active" /> : null; })}</g>
              <g className="nodes">{positioned.map((node) => {
                const count = childrenMap.get(node.id)?.length ?? 0;
                const isFocus = node.id === focus.id, isSelected = node.id === selected.id;
                const color = branchMeta[node.branch].color;
                return <g key={node.id} className={`node-card ${isSelected ? "selected" : ""} ${emphasized(node.id) ? "active" : "muted"}`} transform={`translate(${node.x} ${node.y})`} onClick={() => setSelectedId(node.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setSelectedId(node.id); }} aria-label={`选择知识点：${node.title}`}>
                  <rect width={NODE_W} height={NODE_H} rx="11" style={{ "--node-color": color } as React.CSSProperties} /><rect width="4" height={NODE_H} rx="2" fill={color} />
                  <text x="15" y="22" className="node-title">{node.title.length > 20 ? `${node.title.slice(0, 20)}…` : node.title}</text><text x="15" y="43" className="node-fact">{node.subtitle.length > 30 ? `${node.subtitle.slice(0, 30)}…` : node.subtitle}</text><text x="15" y="56" className="node-branch">{branchMeta[node.branch].label}</text>
                  {count > 0 ? <g className={`disclosure-control small ${isFocus ? "open" : ""}`} transform="translate(232 20)" onClick={(event) => { event.stopPropagation(); isFocus ? (node.parent ? collapse() : undefined) : reveal(node.id); }} role="button" aria-label={isFocus ? (node.parent ? "收起" : "根节点已展开") : `展开 ${count} 个节点`}><text x="-12" y="4" textAnchor="end" className="child-count">{count}</text><rect x="-8" y="-8" width="16" height="16" rx="4" /><text x="0" y="4" textAnchor="middle">{isFocus ? (node.parent ? "−" : "·") : "+"}</text></g> : <circle cx="234" cy="32" r="3" fill={color} opacity=".65" />}
                </g>;
              })}</g>
            </g>
          </svg>

        </div>

        <aside className={inspectorOpen ? "inspector open" : "inspector"}>
          <button className="inspector-toggle" onClick={() => setInspectorOpen((value) => !value)} aria-label={inspectorOpen ? "收起详情" : "展开详情"}>{inspectorOpen ? "›" : "‹"}</button>
          <div className="inspector-content"><div className="inspector-tabs" role="tablist" aria-label="右侧面板"><button role="tab" aria-selected={inspectorTab === "card"} className={inspectorTab === "card" ? "active" : ""} onClick={() => setInspectorTab("card")}>知识卡片</button><button role="tab" aria-selected={inspectorTab === "agent"} className={inspectorTab === "agent" ? "active" : ""} onClick={() => setInspectorTab("agent")}>Agent</button></div>
            {inspectorTab === "card" ? <div className="inspector-pane">
              <div className="detail-kicker"><i style={{ background: branchMeta[selected.branch].color }} />{branchMeta[selected.branch].label}{selectedChildren.length > 0 && <span>{selectedChildren.length} 条下游关系</span>}</div>
              <h2>{selected.title}</h2><p className="detail-subtitle">{selected.subtitle}</p><p className="detail-summary"><strong>{selected.title}</strong>：{selected.summary}</p>
              {selected.formula && <FormulaCard nodeId={selected.id} fallback={selected.formula} />}
              {selected.details?.length ? <DetailBlock title="具体知识" items={selected.details} /> : null}
              {selected.impact && <DetailText title="工程影响" text={selected.impact} />}
              {selected.verification && <DetailText title="如何验证" text={selected.verification} />}
              {selected.pitfall && <DetailText title="常见误区 / 失效条件" text={selected.pitfall} warning />}
              <div className="path-card"><div className="section-label">知识链路</div><div className="breadcrumbs">{[...selectedAncestors].reverse().map((node) => <button key={node.id} onClick={() => reveal(node.id)}>{node.title}<span>→</span></button>)}<b>{selected.title}</b></div></div>
              {selectedChildren.length > 0 && <div className="detail-group"><div className="section-label">关联知识</div><div className="child-list">{selectedChildren.map((node) => <button key={node.id} onClick={() => reveal(node.id)}><i style={{ background: branchMeta[node.branch].color }} /><span><b>{node.title}</b><small>{node.subtitle}</small></span><em>＋</em></button>)}</div></div>}
            </div> : <AgentPlaceholder selected={selected} onBackToCard={() => setInspectorTab("card")} />}
          </div>
        </aside>
      </section>
      <footer className="statusbar"><span><i className="online" />P0.4 知识图谱 · 具体事实与方法节点</span><span>点击节点阅读 · 小型 ＋/− 展开收起 · 有界拖动</span><span>右侧提供知识卡片与当前节点优先 Agent</span></footer>
    </main>
  );
}

function KnowledgeTreeItem({ node, depth, focusId, selectedId, expanded, onToggle, onReveal }: {
  node: KnowledgeNode;
  depth: number;
  focusId: string;
  selectedId: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onReveal: (id: string) => void;
}) {
  const children = childrenMap.get(node.id) ?? [];
  const isOpen = expanded.has(node.id);
  const active = node.id === focusId || node.id === selectedId;
  return <div className="tree-node" role="treeitem" aria-expanded={children.length ? isOpen : undefined}>
    <div className={`tree-row ${active ? "active" : ""}`} style={{ paddingLeft: 5 + depth * 13 }}>
      <button className={`tree-chevron ${isOpen ? "open" : ""}`} onClick={() => children.length && onToggle(node.id)} aria-label={children.length ? `${isOpen ? "收起" : "展开"}${node.title}` : undefined} tabIndex={children.length ? 0 : -1}>{children.length ? "›" : "·"}</button>
      <button className="tree-label" onClick={() => onReveal(node.id)} title={node.title}><i style={{ background: branchMeta[node.branch].color }} /><span>{node.title}</span>{children.length ? <small>{children.length}</small> : null}</button>
    </div>
    {children.length && isOpen ? <div className="tree-children" role="group">{children.map((child) => <KnowledgeTreeItem key={child.id} node={child} depth={depth + 1} focusId={focusId} selectedId={selectedId} expanded={expanded} onToggle={onToggle} onReveal={onReveal} />)}</div> : null}
  </div>;
}

function Latex({ value, inline = false }: { value: string; inline?: boolean }) {
  const html = useMemo(() => katex.renderToString(value, { displayMode: !inline, throwOnError: false, strict: "warn", trust: false, output: "htmlAndMathml" }), [value, inline]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function FormulaCard({ nodeId, fallback }: { nodeId: string; fallback: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const meta = formulaMeta[nodeId];
  const latex = meta?.latex ?? fallback;
  const symbols: FormulaSymbol[] = meta?.symbols ?? [];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(latex);
    } catch {
      const field = document.createElement("textarea"); field.value = latex; document.body.appendChild(field); field.select(); document.execCommand("copy"); field.remove();
    }
    setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  };
  return <div className="formula-card" id={`formula-${nodeId}`}>
    <div className="formula-head"><a href={`?node=${encodeURIComponent(nodeId)}#formula-${nodeId}`} aria-label="链接到此公式">FORMULA #</a><div className="formula-actions"><button onClick={copy}>{copied ? "已复制" : "复制 LaTeX"}</button><button className={expanded ? "active" : ""} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={`formula-symbols-${nodeId}`} title="展开字母与符号解释">?</button></div></div>
    <div className="formula-render"><Latex value={latex} /></div>
    {expanded && <div className="formula-symbols" id={`formula-symbols-${nodeId}`}>{symbols.length ? symbols.map((symbol) => <div key={symbol.symbol}><strong><Latex value={symbol.latex} inline /></strong><span>{symbol.explanation}</span>{symbol.unit && <small>单位：{symbol.unit}</small>}</div>) : <p>该公式暂不需要额外符号说明。</p>}</div>}
  </div>;
}

function AgentPlaceholder({ selected, onBackToCard }: { selected: KnowledgeNode; onBackToCard: () => void }) {
  return <div className="agent-pane"><div className="agent-context"><span>当前节点优先</span><strong>{selected.title}</strong><small>回答将先使用当前知识卡片；信息不足时才扩展检索。</small></div><div className="agent-empty"><i>AI</i><strong>Agent 接口预留</strong><p>当前版本不需要 API Key，基础知识图谱可独立运行。后续接入服务后，会明确标注回答是否使用了其他知识节点。</p><button onClick={onBackToCard}>查看当前知识卡片</button></div><div className="agent-input"><textarea disabled placeholder={`围绕“${selected.title}”提问…`} /><button disabled aria-label="发送问题">↑</button></div></div>;
}

function DetailBlock({ title, items }: { title: string; items: string[] }) {
  return <div className="detail-text"><div className="section-label">{title}</div><ul>{items.map((item, index) => <li key={item}>{index === 0 ? <strong>{item}</strong> : item}</li>)}</ul></div>;
}
function DetailText({ title, text, warning = false }: { title: string; text: string; warning?: boolean }) {
  return <div className={`detail-text ${warning ? "warning" : ""}`}><div className="section-label">{title}</div><p>{text}</p></div>;
}
