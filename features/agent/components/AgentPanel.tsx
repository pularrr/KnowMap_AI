"use client";

import { useState, type FormEvent } from "react";
import type { AgentInteractionResult, PendingChangeView } from "../../../core/agent/online-contracts";
import type { KnowledgeNode } from "../../knowledge-graph/model/knowledgeViewModel";
import { appendKnowledgeHistory } from "../../knowledge-graph/model/knowledgeHistory";

type PanelMode = "collapsed" | "compact" | "overlay";
type Message = { id: string; label: string; text: string; result?: AgentInteractionResult };

export function AgentPanel({ selected, sessionId, onCommitted }: { selected: KnowledgeNode; sessionId: string; onReveal: (id: string) => void; onCommitted?: () => Promise<void> | void }) {
  const [mode, setMode] = useState<PanelMode>("compact");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const request = async (path: string, payload: object): Promise<AgentInteractionResult> => {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Agent 请求失败。");
    return result as AgentInteractionResult;
  };

  const run = async (kind: "answer" | "deep-search" | "ingest") => {
    if (kind === "answer" && !query.trim()) return;
    setBusy(true);
    setError("");
    setMode((current) => current === "collapsed" ? "compact" : current);
    try {
      const path = kind === "answer" ? "/api/agent/chat" : kind === "ingest" ? "/api/knowledge/ingest" : "/api/agent/deep-search";
      const result = await request(path, { sessionId, nodeId: selected.id, query, text: query, kind: "document", title: "对话与资料整理" });
      setMessages((current) => [...current, { id: result.runId, label: kind === "answer" ? (result.mode === "online" ? "AI 回答" : "离线回答") : kind === "ingest" ? "资料整理" : (result.mode === "online" ? "深度搜索" : "离线覆盖检查"), text: result.text, result }]);
      appendKnowledgeHistory({ nodeId: selected.id, kind: result.candidate ? "candidate_generated" : "question_summary", summary: result.candidate?.summary ?? result.text });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent 请求失败。");
    } finally {
      setBusy(false);
    }
  };

  const ask = (event: FormEvent) => { event.preventDefault(); void run("answer"); };

  const summarize = () => {
    const text = messages.length
      ? messages.slice(-6).map((message) => `${message.label}：${message.text}`).join("\n").slice(0, 1_200)
      : "当前还没有可总结的对话。";
    setMessages((current) => [...current, { id: `summary-${Date.now()}`, label: "对话摘要", text }]);
  };

  const confirm = async (candidate: PendingChangeView) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/agent/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, patchId: candidate.patchId, confirmationToken: candidate.confirmationToken }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "确认失败。");
      setMessages((current) => current.map((message) => message.result?.candidate?.patchId === candidate.patchId ? { ...message, label: "已写入图谱", result: { ...message.result, candidate: undefined }, text: `${message.text}\n\n已确认写入修订 ${result.revision}。` } : message));
      await onCommitted?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认失败。");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (messageId: string, candidate: PendingChangeView) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/agent/reject", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, patchId: candidate.patchId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "拒绝失败。");
      setMessages((current) => current.filter((item) => item.id !== messageId));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "拒绝失败。"); }
    finally { setBusy(false); }
  };

  return (
    <section className={`graph-agent ${mode}`} aria-label="知识图谱 Agent" aria-busy={busy}>
      <header className="graph-agent-head">
        <div><span>AI AGENT</span><strong>{selected.title}</strong></div>
        <div className="graph-agent-actions">
          <button className="deep-search-button" onClick={() => void run("deep-search")} disabled={busy}>深度搜索</button>
          <button className="summary-button" onClick={summarize} disabled={busy}>总结对话</button>
          <button className="summary-button" onClick={() => void run("ingest")} disabled={busy || !query.trim()}>整理资料</button>
          <button className="agent-expand" onClick={() => setMode((current) => current === "overlay" ? "compact" : "overlay")} aria-label={mode === "overlay" ? "退出大窗" : "展开为大窗"}>{mode === "overlay" ? "↙" : "↗"}</button>
          <button className="agent-collapse" onClick={() => setMode((current) => current === "collapsed" ? "compact" : "collapsed")} aria-label={mode === "collapsed" ? "展开 Agent" : "收起 Agent"}>{mode === "collapsed" ? "⌃" : "⌄"}</button>
        </div>
      </header>
      {mode !== "collapsed" ? <div className="graph-agent-body">
        <form className="agent-query" onSubmit={ask}><label htmlFor="agent-query">围绕当前节点提问</label><div><textarea id="agent-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`询问“${selected.title}”，或描述需要扩充的方向`} /><button type="submit" disabled={busy || !query.trim()} aria-label="发送问题">↑</button></div></form>
        <div className="agent-thread" aria-live="polite">
          {busy ? <p className="agent-running">Agent 正在观察、检索与判断…</p> : null}
          {messages.length ? messages.map((message) => <article key={message.id} className={`agent-message ${message.result?.candidate ? "knowledge_candidate" : ""}`}><span>{message.label}{message.result?.model ? <em>{message.result.model}</em> : null}</span><p>{message.text}</p>{message.result?.observations.length ? <details className="observation-log"><summary>{message.result.observations.length} 次知识观察</summary><ol>{message.result.observations.map((item) => <li key={`${message.id}-${item.round}`}>{item.summary}</li>)}</ol></details> : null}{message.result?.candidate ? <div className="candidate-details"><b>{message.result.candidate.summary}</b><p>{message.result.candidate.rationale}</p><small>新增 {message.result.candidate.projectionDiff.nodes.added.length} 个节点，更新 {message.result.candidate.projectionDiff.cards.updated.length + message.result.candidate.projectionDiff.cards.added.length} 张卡片</small><div className="candidate-actions"><button onClick={() => void confirm(message.result!.candidate!)} disabled={busy}>确认写入</button><button onClick={() => void reject(message.id, message.result!.candidate!)} disabled={busy}>拒绝</button></div></div> : null}{message.result?.warning ? <small className="message-warning">{message.result.warning}</small> : null}</article>) : <p className="agent-thread-empty">可以直接提问，也可以启动深度搜索扩充当前节点。</p>}
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </div> : null}
    </section>
  );
}
