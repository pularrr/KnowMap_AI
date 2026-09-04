/**
 * 应用配置（脚手架创建时自动替换占位符）
 *
 * 这些值由 create-app.mjs 根据 --name 和 --profile 参数自动生成。
 * 不要手动修改，除非你知道自己在做什么。
 */

export const APP_CONFIG = {
  /** 应用名称（显示在页面标题中） */
  appName: "{{APP_NAME}}",
  /** 应用副标题/描述 */
  appSubtitle: "{{APP_SUBTITLE}}",
  /** 根节点 ID（知识图谱的入口节点） */
  rootNodeId: "{{ROOT_NODE_ID}}",
  /** localStorage key 前缀（避免不同应用冲突） */
  storagePrefix: "{{STORAGE_PREFIX}}",
  /** 页面 eyebrow 文本 */
  eyebrow: "{{EYEBROW}}",
} as const;
