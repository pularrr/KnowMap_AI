"use client";

import { branchMeta, getKnowledgeCard } from "../model/knowledgeViewModel";
import { ancestorsOf, childrenMap, nodeMap } from "../layout/legacySvgLayout";
import { FormulaCard } from "./FormulaCard";

type KnowledgeCardPanelProps = {
  selectedId: string;
  onReveal: (id: string) => void;
};

export function KnowledgeCardPanel({ selectedId, onReveal }: KnowledgeCardPanelProps) {
  const selected = nodeMap.get(selectedId) ?? nodeMap.get("fmcw")!;
  const selectedAncestors = ancestorsOf(selected.id);
  const selectedChildren = childrenMap.get(selected.id) ?? [];
  const card = getKnowledgeCard(selected.id);

  return (
    <div className="inspector-pane">
      <div className="detail-kicker">
        <i style={{ background: branchMeta[selected.branch].color }} />
        {branchMeta[selected.branch].label}
        {selectedChildren.length > 0 && <span>{selectedChildren.length} 条下游关系</span>}
      </div>
      <h2>{selected.title}</h2>
      <p className="detail-subtitle">{selected.subtitle}</p>
      <p className="detail-summary">
        <strong>{selected.title}</strong>：{selected.summary}
      </p>
      {selected.formula && <FormulaCard nodeId={selected.id} fallback={selected.formula} />}
      {card?.sections.map((section, index) => (
        <details
          className={`detail-text ${section.type === "failure_mode" || section.type === "misconception" ? "warning" : ""}`}
          key={`${section.type}-${section.title}-${index}`}
          open={index === 0}
        >
          <summary className="section-label">{section.title}</summary>
          {section.text ? <p>{section.text}</p> : null}
          {section.items?.length ? (
            <ul>
              {section.items.map((item, itemIndex) => (
                <li key={item}>{itemIndex === 0 ? <strong>{item}</strong> : item}</li>
              ))}
            </ul>
          ) : null}
        </details>
      ))}
      <div className="path-card">
        <div className="section-label">知识链路</div>
        <div className="breadcrumbs">
          {[...selectedAncestors].reverse().map((node) => (
            <button key={node.id} onClick={() => onReveal(node.id)}>
              {node.title}
              <span>→</span>
            </button>
          ))}
          <b>{selected.title}</b>
        </div>
      </div>
      {selectedChildren.length > 0 && (
        <div className="detail-group">
          <div className="section-label">关联知识</div>
          <div className="child-list">
            {selectedChildren.map((node) => (
              <button key={node.id} onClick={() => onReveal(node.id)}>
                <i style={{ background: branchMeta[node.branch].color }} />
                <span>
                  <b>{node.title}</b>
                  <small>{node.subtitle}</small>
                </span>
                <em>＋</em>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
