"use client";

import { useState, type FormEvent } from "react";
import type { KnowledgeNode } from "../../knowledge-graph/model/knowledgeViewModel";
import {
  answerFromCurrentKnowledge,
  runOfflineDeepSearch,
  type DeepSearchReport,
} from "../model/offlineDeepSearch";

export function AgentPanel({ selected, onReveal }: { selected: KnowledgeNode; onReveal: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [report, setReport] = useState<DeepSearchReport | null>(null);

  const ask = (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setAnswer(answerFromCurrentKnowledge(selected.id, query));
    setCollapsed(false);
  };

  const deepSearch = () => {
    setReport(runOfflineDeepSearch(selected.id));
    setCollapsed(false);
  };

  return (
    <section className={`graph-agent ${collapsed ? "collapsed" : ""}`} aria-label="知识图谱 Agent">
      <header className="graph-agent-head">
        <div>
          <span>AGENT · 当前节点优先</span>
          <strong>{selected.title}</strong>
        </div>
        <div className="graph-agent-actions">
          <button className="deep-search-button" onClick={deepSearch}>本地图谱深度搜索</button>
          <button
            className="agent-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "展开 Agent" : "收起 Agent"}
          >
            {collapsed ? "⌃" : "⌄"}
          </button>
        </div>
      </header>

      {!collapsed ? (
        <div className="graph-agent-body">
          <form className="agent-query" onSubmit={ask}>
            <label htmlFor="agent-query">围绕当前节点提问</label>
            <div>
              <textarea
                id="agent-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`例如：“${selected.title}”还缺少哪些工程设计？`}
              />
              <button type="submit" disabled={!query.trim()} aria-label="发送问题">↑</button>
            </div>
            <small>离线模式先读取当前卡片；信息不足时可启动图谱深度搜索。</small>
          </form>

          <div className="agent-response" aria-live="polite">
            {answer ? (
              <><span>当前知识回答</span><p>{answer}</p></>
            ) : (
              <><span>工作方式</span><p>回答锚定当前节点。若你认为覆盖不足，点击“深度搜索知识缺口”，生成同层、子级、依赖和卡片维度候选。</p></>
            )}
          </div>

          <div className="agent-discovery">
            {report ? (
              <>
                <div className="discovery-summary">
                  <span>只读缺口分析 · 构建候选</span>
                  <b>{report.coverage.present}/{report.coverage.total} 卡片维度已覆盖</b>
                  <p>{report.proposalSummary}</p>
                </div>
                <div className="discovery-list">
                  {report.candidates.slice(0, 5).map((candidate) => (
                    <button key={candidate.nodeId} onClick={() => onReveal(candidate.nodeId)}>
                      <span>{candidate.reason}</span><b>{candidate.title}</b><small>{candidate.summary}</small>
                    </button>
                  ))}
                </div>
                <ul>{report.recommendations.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                <small>本版只生成本地图谱分析，不会自动提交或写入；接入外部检索后再进入四 Agent 与用户确认流程。</small>
              </>
            ) : (
              <div className="discovery-empty">
                <b>需要扩展当前图谱？</b>
                <p>Agent 会进行有界深度搜索并检查知识卡片完整度，形成可追踪的构建建议。</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
