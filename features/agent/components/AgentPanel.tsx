"use client";

import type { KnowledgeNode } from "../../../app/knowledge";

export function AgentPanel({
  selected,
  onBackToCard,
}: {
  selected: KnowledgeNode;
  onBackToCard: () => void;
}) {
  return (
    <div className="agent-pane">
      <div className="agent-context">
        <span>当前节点优先</span>
        <strong>{selected.title}</strong>
        <small>回答将先使用当前知识卡片；信息不足时才扩展检索。</small>
      </div>
      <div className="agent-empty">
        <i>AI</i>
        <strong>Agent 接口预留</strong>
        <p>当前版本不需要 API Key，基础知识图谱可独立运行。后续接入服务后，会明确标注回答是否使用了其他知识节点。</p>
        <button onClick={onBackToCard}>查看当前知识卡片</button>
      </div>
      <div className="agent-input">
        <textarea disabled placeholder={`围绕“${selected.title}”提问…`} />
        <button disabled aria-label="发送问题">
          ↑
        </button>
      </div>
    </div>
  );
}
