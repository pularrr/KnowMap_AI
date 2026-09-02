"use client";

import { useEffect, useState } from "react";
import { AgentPanel } from "../features/agent/components/AgentPanel";
import { KnowledgeCardPanel } from "../features/knowledge-graph/components/KnowledgeCardPanel";
import { KnowledgeGraphCanvas } from "../features/knowledge-graph/components/KnowledgeGraphCanvas";
import { KnowledgeTree } from "../features/knowledge-graph/components/KnowledgeTree";
import { nodeMap } from "../features/knowledge-graph/layout/legacySvgLayout";
import {
  branchMeta,
  graphRevision,
  knowledgeNodes,
  semanticDomainCount,
} from "../features/knowledge-graph/model/knowledgeViewModel";

type InspectorTab = "card" | "agent";

// Extracted UI contract: 知识域树 · 复制 LaTeX · 展开字母与符号解释 · 开启或关闭连线流动 · 当前节点优先

export default function Home() {
  const [focusId, setFocusId] = useState("fmcw");
  const [selectedId, setSelectedId] = useState("fmcw");
  const [dark, setDark] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("card");

  useEffect(() => {
    setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("node");
    if (requested && nodeMap.has(requested)) {
      setFocusId(requested);
      setSelectedId(requested);
    }
  }, []);

  const selected = nodeMap.get(selectedId) ?? nodeMap.get("fmcw")!;

  const reveal = (id: string) => {
    if (!nodeMap.has(id)) return;
    setFocusId(id);
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("node", id);
    url.hash = "";
    window.history.replaceState({}, "", url);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <div className="eyebrow">RADAR SYSTEMS · KNOWLEDGE GRAPH</div>
            <h1>
              FMCW 雷达全栈知识图谱 <em>P1.0</em>
            </h1>
          </div>
        </div>
        <div className="top-actions">
          <div className="graph-stat">
            <b>{knowledgeNodes.length}</b>
            <span>具体知识节点</span>
          </div>
          <div className="graph-stat">
            <b>{semanticDomainCount}</b>
            <span>语义知识域</span>
          </div>
          <button
            className="theme-button"
            onClick={() => setDark((value) => !value)}
            aria-label={dark ? "切换为明亮主题" : "切换为暗色主题"}
          >
            <span className="theme-orbit">{dark ? "☾" : "☼"}</span>
            <span>{dark ? "暗色" : "明亮"}</span>
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="FMCW 雷达知识图谱工作区">
        <KnowledgeTree focusId={focusId} selectedId={selectedId} onReveal={reveal} />
        <KnowledgeGraphCanvas
          focusId={focusId}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onReveal={reveal}
        />
        <aside className={inspectorOpen ? "inspector open" : "inspector"}>
          <button
            className="inspector-toggle"
            onClick={() => setInspectorOpen((value) => !value)}
            aria-label={inspectorOpen ? "收起详情" : "展开详情"}
          >
            {inspectorOpen ? "›" : "‹"}
          </button>
          <div className="inspector-content">
            <div className="inspector-tabs" role="tablist" aria-label="右侧面板">
              <button
                role="tab"
                aria-selected={inspectorTab === "card"}
                className={inspectorTab === "card" ? "active" : ""}
                onClick={() => setInspectorTab("card")}
              >
                知识卡片
              </button>
              <button
                role="tab"
                aria-selected={inspectorTab === "agent"}
                className={inspectorTab === "agent" ? "active" : ""}
                onClick={() => setInspectorTab("agent")}
              >
                Agent
              </button>
            </div>
            {inspectorTab === "card" ? (
              <KnowledgeCardPanel selectedId={selectedId} onReveal={reveal} />
            ) : (
              <AgentPanel selected={selected} onBackToCard={() => setInspectorTab("card")} />
            )}
          </div>
        </aside>
      </section>

      <footer className="statusbar">
        <span>
          <i className="online" />P1.0 知识图谱 · 数据修订 {graphRevision}
        </span>
        <span>点击节点阅读 · 小型 ＋/− 展开收起 · 有界拖动</span>
        <span>右侧提供知识卡片与当前节点优先 Agent</span>
      </footer>
    </main>
  );
}
