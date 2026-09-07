import { referenceResearch } from "@/examples/fmcw-radar/data/knowledge/react-reference";
import { expandedKnowledgeDataset } from "@/examples/fmcw-radar/data/knowledge/deep-slices";
import type { KnowledgeDataset } from "../../core/knowledge/schema";
import type { KnowledgeProposal } from "../../core/agent/contracts";
import { operationsFromResearch } from "../agent/research-build";
import { applyOperations, deterministicId } from "../../core/agent/graph-operations";
import { agentGraphToDataset, datasetToAgentGraph } from "../../core/knowledge/portable-bundle";
import { OfflineBuildAgent, OfflineReviewAgent } from "../../core/agent/offline-agents";

export function prepareReferenceProposal(dataset: KnowledgeDataset): KnowledgeProposal {
  const prepared = operationsFromResearch(referenceResearch,dataset,"fmcw");
  const group = prepared.operations.find((op) => op.kind === "upsert-node" && op.node.canonicalName === "线性分配求解器");
  const groupNode = group?.kind === "upsert-node" ? group.node : dataset.nodes.find((n) => n.canonicalName === "线性分配求解器");
  const hungarian = dataset.nodes.find((n) => n.id === "hungarian-algorithm");
  if (groupNode && hungarian?.primaryParentId === "deterministic-assignment") {
    const queue = [{node:hungarian,parentId:groupNode.id,level:groupNode.level!+1}];
    while(queue.length) {
      const {node,parentId,level} = queue.shift()!;
      prepared.operations.push({kind:"upsert-node",node:{...node,primaryParentId:parentId,level}});
      for (const child of dataset.nodes.filter((n)=>n.primaryParentId===node.id)) queue.push({node:child,parentId:node.id,level:level+1});
    }
  }
  return {id:deterministicId("reference-proposal",{revision:dataset.revision,operations:prepared.operations}),
    baseRevision:dataset.revision,context:{currentNodeId:"fmcw",conversationSummary:referenceResearch.answer},
    summary:prepared.summary,rationale:prepared.rationale,evidence:prepared.evidence.map((e)=>({id:e.id,title:e.title,source:e.locator ?? "development-assistant",note:e.excerpt})),
    candidateOperations:prepared.operations,createdAt:new Date().toISOString(),createdBy:"knowledge-agent"};
}

export function buildReferenceDataset(base = expandedKnowledgeDataset) {
  const proposal = prepareReferenceProposal(base);
  const snapshot = {...datasetToAgentGraph(base),revision:base.revision};
  const review = new OfflineReviewAgent().review(proposal,snapshot);
  if (!review.accepted) throw new Error(review.findings.map((f)=>f.message).join("; "));
  const patch = new OfflineBuildAgent().build(proposal,review,snapshot);
  return {dataset:agentGraphToDataset(applyOperations(snapshot,patch.operations,base.revision+1)),patch,review};
}
