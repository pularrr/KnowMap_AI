/**
 * 通用初始知识数据集
 *
 * 只包含一个根节点，应用启动后从 API 动态加载实际知识数据。
 * 如果用户尚未生成知识网络，显示空状态并引导用户配置 LLM。
 */

import type { KnowledgeDataset } from "@/core/knowledge/schema";
import { APP_CONFIG } from "@/app/config";

/**
 * 创建空的初始知识数据集
 * 只包含一个根节点，实际数据通过 /api/knowledge 动态加载
 */
export function createInitialDataset(): KnowledgeDataset {
  const rootNodeId = APP_CONFIG.rootNodeId;
  const rootNodeName = APP_CONFIG.appName;

  return {
    revision: 1,
    domains: [],
    nodes: [
      {
        id: rootNodeId,
        canonicalName: rootNodeName,
        shortFact: `${rootNodeName}知识网络，等待生成...`,
        aliases: [],
        nodeType: "domain",
        domainId: "" as any,
        visualBranch: "" as any,
        primaryParentId: null,
        level: 0,
        order: 0,
        tags: [],
        status: "reviewed",
      },
    ],
    cards: [
      {
        id: "card-root",
        nodeId: rootNodeId,
        headline: "定义与边界",
        blocks: [
          {
            type: "definition",
            title: "定义与边界",
            contentText: `${rootNodeName}知识网络尚未生成。请先在右上角配置 LLM，然后点击"生成知识网络"按钮。`,
          },
        ],
        formulaIds: [],
        evidenceIds: [],
        revision: 1,
      },
    ],
    formulas: [],
    edges: [],
  };
}

/** 导出初始数据集（兼容旧代码） */
export const expandedKnowledgeDataset = createInitialDataset();
