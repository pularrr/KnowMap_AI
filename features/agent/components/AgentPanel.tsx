"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AgentInteractionResult, PendingChangeView } from "../../../core/agent/online-contracts";
import type { KnowledgeNode } from "../../knowledge-graph/model/knowledgeViewModel";
import { appendKnowledgeHistory } from "../../knowledge-graph/model/knowledgeHistory";
import { MarkdownMessage } from "./MarkdownMessage";

type PanelMode = "collapsed" | "compact" | "overlay";
type MessageRole = "user" | "assistant";
type IngestKind = "conversation" | "summary" | "paper" | "document";
type Message = {
  id: string;
  role: MessageRole;
  label: string;
  text: string;
  streaming?: boolean;
  result?: AgentInteractionResult;
};

type SseEvent = { event: string; data: Record<string, unknown> };

function parseSseBlock(block: string): SseEvent | undefined {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return undefined;
  try {
    const parsed = JSON.parse(data) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { event, data: parsed as Record<string, unknown> };
    }
  } catch {
    // Ignore malformed frames and keep waiting for the next complete block.
  }
  return undefined;
}

export function AgentPanel({ selected, sessionId, onCommitted }: { selected: KnowledgeNode; sessionId: string; onReveal: (id: string) => void; onCommitted?: () => Promise<void> | void }) {
  const [mode, setMode] = useState<PanelMode>("compact");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ingestKind, setIngestKind] = useState<IngestKind>("document");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages]);

  const request = async (path: string, payload: object): Promise<AgentInteractionResult> => {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Agent 请求失败。");
    return result as AgentInteractionResult;
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (!text || busy) return;
    const pendingId = `reply-${Date.now()}`;
    setQuery("");
    setError("");
    setBusy(true);
    setMode((current) => (current === "collapsed" ? "compact" : current));
    setMessages((current) => [
      ...current,
      { id: `user-${pendingId}`, role: "user", label: "你", text },
      { id: pendingId, role: "assistant", label: "AI 回答", text: "", streaming: true },
    ]);
    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, nodeId: selected.id, query: text }),
      });
      if (!response.ok || !response.body) {
        const result = await response.json().catch(() => undefined) as { error?: string } | undefined;
        throw new Error(result?.error ?? "Agent 请求失败。");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finalResult: AgentInteractionResult | undefined;
      let sawDone = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const parsed = parseSseBlock(block);
          if (!parsed) continue;
          if (parsed.event === "meta") {
            const meta = parsed.data;
            const label = meta.mode === "online" ? "AI 回答" : "离线回答";
            const model = typeof meta.model === "string" ? meta.model : "";
            setMessages((current) => current.map((item) => (item.id === pendingId ? { ...item, label: `${label}${model ? ` · ${model}` : ""}` } : item)));
          } else if (parsed.event === "delta") {
            const delta = typeof parsed.data.text === "string" ? parsed.data.text : "";
            if (delta) setMessages((current) => current.map((item) => (item.id === pendingId ? { ...item, text: item.text + delta } : item)));
          } else if (parsed.event === "done") {
            finalResult = parsed.data.result as AgentInteractionResult;
            sawDone = true;
            setMessages((current) => current.map((item) => (item.id === pendingId ? { ...item, streaming: false, result: finalResult } : item)));
          } else if (parsed.event === "error") {
            const message = typeof parsed.data.message === "string" ? parsed.data.message : "Agent 请求失败。";
            throw new Error(message);
          }
        }
      }
      if (finalResult) {
        appendKnowledgeHistory({ nodeId: selected.id, kind: finalResult.candidate ? "candidate_generated" : "question_summary", summary: finalResult.candidate?.summary ?? finalResult.text });
      } else if (!sawDone) {
        setMessages((current) => current.map((item) => (item.id === pendingId ? { ...item, streaming: false } : item)));
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Agent 请求失败。";
      setError(message);
      setMessages((current) => current.map((item) => (item.id === pendingId ? { ...item, streaming: false, label: "回答失败" } : item)));
    } finally {
      setBusy(false);
    }
  };

  const run = async (kind: "deep-search" | "ingest") => {
    if (busy) return;
    setError("");
    setBusy(true);
    setMode((current) => (current === "collapsed" ? "compact" : current));
    const userText = kind === "ingest" ? query.trim() : "";
    const label = kind === "ingest" ? "资料整理" : "深度搜索";
    const pendingId = `task-${Date.now()}`;
    if (userText) {
      setQuery("");
      setMessages((current) => [...current, { id: `user-${pendingId}`, role: "user", label: "你", text: userText }]);
    }
    setMessages((current) => [...current, { id: pendingId, role: "assistant", label, text: "", streaming: true }]);
    try {
      const path = kind === "ingest" ? "/api/knowledge/ingest" : "/api/agent/deep-search";
      const result = await request(path, { sessionId, nodeId: selected.id, query: userText || query, text: userText, kind: kind === "ingest" ? ingestKind : undefined, title: kind === "ingest" ? `资料整理（${ingestKind}）` : undefined });
      const finalLabel = kind === "ingest" ? "资料整理" : result.mode === "online" ? "深度搜索" : "离线覆盖检查";
      setMessages((current) => current.map((item) => (item.id === pendingId ? { ...item, label: finalLabel, text: result.text, streaming: false, result } : item)));
      appendKnowledgeHistory({ nodeId: selected.id, kind: result.candidate ? "candidate_generated" : "question_summary", summary: result.candidate?.summary ?? result.text });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Agent 请求失败。";
      setError(message);
      setMessages((current) => current.map((item) => (item.id === pendingId ? { ...item, streaming: false, label: `${label}失败` } : item)));
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (busy) return;
    setError("");
    setBusy(true);
    setMode((current) => (current === "collapsed" ? "compact" : current));
    const pendingId = `file-${Date.now()}`;
    setMessages((current) => [...current, { id: pendingId, role: "assistant", label: `资料整理（${file.name}）`, text: "", streaming: true }]);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("sessionId", sessionId);
      form.append("nodeId", selected.id);
      form.append("kind", ingestKind);
      const response = await fetch("/api/knowledge/ingest-file", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "文件整理失败。");
      const notes = result.parsedNotes?.length ? `\n\n> 解析说明：${result.parsedNotes.join("；")}` : "";
      setMessages((current) => current.map((item) => (item.id === pendingId ? { ...item, label: result.mode === "online" ? "资料整理" : "离线覆盖检查", text: `${result.text}${notes}`, streaming: false, result } : item)));
      appendKnowledgeHistory({ nodeId: selected.id, kind: result.candidate ? "candidate_generated" : "question_summary", summary: result.candidate?.summary ?? result.text });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "文件整理失败。";
      setError(message);
      setMessages((current) => current.map((item) => (item.id === pendingId ? { ...item, streaming: false, label: "整理失败", text: message } : item)));
    } finally {
      setBusy(false);
    }
  };

  const summarize = () => {
    const text = messages.length
      ? messages.slice(-6).map((message) => `${message.label}：${message.text}`).join("\n").slice(0, 1_200)
      : "当前还没有可总结的对话。";
    setMessages((current) => [...current, { id: `summary-${Date.now()}`, role: "assistant", label: "对话摘要", text }]);
  };

  const confirm = async (candidate: PendingChangeView) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/agent/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId, patchId: candidate.patchId, confirmationToken: candidate.confirmationToken }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "确认失败。");
      setMessages((current) => current.map((message) => message.result?.candidate?.patchId === candidate.patchId ? { ...message, label: "已写入图谱", result: { ...message.result, candidate: undefined }, text: `${message.text}\n\n**已确认写入修订 ${result.revision}。**` } : message));
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
          <label className="summary-button file-upload-label" aria-disabled={busy}>
            上传资料
            <input type="file" accept=".pdf,image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); e.target.value = ""; }} disabled={busy} />
          </label>
          <button className="summary-button" onClick={() => void run("ingest")} disabled={busy || !query.trim()}>整理资料</button>
          <button className="agent-expand" onClick={() => setMode((current) => (current === "overlay" ? "compact" : "overlay"))} aria-label={mode === "overlay" ? "退出大窗" : "展开为大窗"}>{mode === "overlay" ? "↙" : "↗"}</button>
          <button className="agent-collapse" onClick={() => setMode((current) => (current === "collapsed" ? "compact" : "collapsed"))} aria-label={mode === "collapsed" ? "展开 Agent" : "收起 Agent"}>{mode === "collapsed" ? "⌃" : "⌄"}</button>
        </div>
      </header>
      {mode !== "collapsed" ? <div className="graph-agent-body">
        <form className="agent-query" onSubmit={ask}><label htmlFor="agent-query">围绕当前节点提问</label><div><textarea id="agent-query" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={`询问“${selected.title}”，Enter 发送，Shift+Enter 换行；或粘贴资料后点“整理资料”`} /><button type="submit" disabled={busy || !query.trim()} aria-label="发送问题">↑</button></div><div className="ingest-kind-bar"><span>资料类型：</span><select value={ingestKind} onChange={(e) => setIngestKind(e.target.value as IngestKind)} disabled={busy} aria-label="选择资料类型"><option value="document">文档</option><option value="conversation">对话记录</option><option value="summary">知识摘要</option><option value="paper">文献/技术方案</option></select></div>{busy ? <small className="agent-busy-hint">回答生成中，可稍候…</small> : null}</form>
        <div className="agent-thread" ref={threadRef} aria-live="polite">
          {messages.length ? messages.map((message) => (
            <article key={message.id} className={`agent-message ${message.role}${message.result?.candidate ? " knowledge_candidate" : ""}${message.streaming ? " streaming" : ""}`}>
              <span>{message.label}{message.result?.model ? <em>{message.result.model}</em> : null}</span>
              {message.role === "user" ? <p className="user-text">{message.text}</p> : (message.streaming && !message.text) ? <p className="agent-thinking"><i /><i /><i />正在思考…</p> : <MarkdownMessage text={message.text || (message.streaming ? "…" : "（空回答）")} />}
              {message.streaming && message.text ? <span className="stream-cursor" aria-hidden="true">▍</span> : null}
              {message.result?.observations.length ? <details className="observation-log"><summary>{message.result.observations.length} 次知识观察</summary><ol>{message.result.observations.map((item) => <li key={`${message.id}-${item.round}`}>{item.summary}</li>)}</ol></details> : null}
              {message.result?.candidate ? <div className="candidate-details"><b>{message.result.candidate.summary}</b><p>{message.result.candidate.rationale}</p><small>新增 {message.result.candidate.projectionDiff.nodes.added.length} 个节点，更新 {message.result.candidate.projectionDiff.cards.updated.length + message.result.candidate.projectionDiff.cards.added.length} 张卡片</small><div className="candidate-actions"><button onClick={() => void confirm(message.result!.candidate!)} disabled={busy}>确认写入</button><button onClick={() => void reject(message.id, message.result!.candidate!)} disabled={busy}>拒绝</button></div></div> : null}
              {message.result?.warning ? <small className="message-warning">{message.result.warning}</small> : null}
            </article>
          )) : <p className="agent-thread-empty">可以直接提问，也可以启动深度搜索扩充当前节点。</p>}
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </div> : null}
    </section>
  );
}
