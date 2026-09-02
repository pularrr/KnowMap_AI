# 交互生长式 FMCW 知识图谱：已审查架构方案

## 产品定义

本项目是可独立运行的知识可视化应用，也是后续 AI 辅助生长的知识图谱。
未配置模型或 API Key 时，完整静态图谱、搜索、关系探索、知识卡片与公式仍可用。

## 三个相互独立的数据层

1. **节点（Node）**：只表达可独立定位和复用的知识实体身份。
2. **关系（Edge）**：表达主层级、相似/替代、依赖、输入输出、实现、影响和验证。
3. **知识卡片（Card）**：承载定义、原理、公式、工程设计、实现、影响、验证、应用、
   误区和研究方向；栏目是可选的，不使用空模板填充内容。

公式保存原始 LaTeX、符号定义、单位、约束和适用假设。界面复制的是原始 LaTeX，
符号说明默认收起。

## 兼容迁移原则

- P0.4 的 98 个 ID、数组顺序、主父级、标题、摘要、详情、公式与 7 条跨节点关系先
  零损迁移，再用独立 GraphPatch 做层级纠错。
- 11 个 semantic domain 用于知识组织；5 个 visual branch 继续承担原 SVG 颜色与根节点
  分组，二者不得混用。
- 现有 SVG 的尺寸、类名、布局与交互先保留，通过 legacy adapter 消费新模型。
- 逻辑层立即与 Sites 解耦；Sites/Vinext 文件只有在标准 Next 构建验收后才归档。

## 关系优先的有界遍历

“同层优先 DFS”定义为产品遍历策略，而不是标准 DFS：

```text
current
→ explicit similar / alternative peers
→ same-parent comparable solutions
→ children
→ directed dependency / input / output
→ parent and background
→ cross-domain context
```

每次遍历必须有稳定排序、visited 去重、深度/数量上限和路径说明。同父节点不会自动
生成 similarity；相似边必须有可比问题、理由和证据。

## 首轮金标准知识切片

### 估计准则

LS、ML、MAP、MMSE 的共同上位概念是“估计准则”，不是“似然估计方法”：LS 最小化
残差；ML 最大化似然；MAP 取后验众数；MMSE 在平方损失下取后验均值。它们只在明确
假设下具有等价或相近关系。IMM 是多模型估计框架，不是 CV/CA/CTRV/CTRA 的同层
运动模型。

### 数据关联

GNN（Global Nearest Neighbor）与 JPDA 是数据关联算法的同层方案；马氏距离是统计
门控/关联代价，作为输入或依赖连接算法。Graph Neural Network 必须使用不同实体和
领域路径消歧。

## 四 Agent 工作流

```text
对话摘要 + 当前节点
→ Knowledge：候选知识、关系、卡片和证据
→ Review：层级、关系方向、冲突、公式与证据门禁
→ Build：确定性 GraphPatch、dry-run、图形 diff
→ Development / Orchestrator：展示预览
→ 用户 confirm / revise / reject
→ 新 revision（或保持零写入）
```

所有 Agent 都无权绕过确认直接写正式图谱。审计记录包含 input hash、base revision、
检索路径、证据、审查意见、diff、确认结果和 apply revision。回滚通过追加新 revision
实现，不删除历史。

## 首轮完成标准

- P0.4 ZIP、SHA、截图和 Git `p0.4-stable` 均可恢复。
- 98 个旧节点、17 个公式、7 条跨关系及全部卡片字段零丢失。
- 11 semantic domains 与 5 visual branches 可独立校验。
- 主树无环、边端点完整、关系方向与理由明确。
- peer-first 查询和可见图投影具有确定顺序、去重、深度与数量边界。
- 两条金标准切片通过结构测试。
- 未确认、审查失败、过期和重复补丁不能误写；确认与回滚均产生审计 revision。
- P0.4 的树、SVG、公式、流动开关、拖缩放、主题和 Agent 占位行为不回归。
- 无 Key、无网络时静态应用完整可用；标准 Next 路径验收后再取消 Sites 默认依赖。
