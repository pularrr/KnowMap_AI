# 工作流 1：Profile 设计工作流

## 目标
根据用户的主题描述，自动设计一个完整的 TaskProfile。

## 触发条件
- 用户要求生成某个主题的知识网络
- 用户要求"像 FMCW 雷达图谱那样"生成其他主题的图谱

## 输入
- 主题描述（必填）
- Profile 偏好（可选）
- 参考资料（可选）

## 步骤

### Step 1：分析主题
1. 理解主题的核心领域和知识结构
2. 识别主题的特点（技术路线/理论体系/工程实践等）
3. 参考 FMCW Profile 的域划分逻辑

### Step 2：设计域划分
1. 设计 3-8 个语义域，每个域代表一个独立的知识领域
2. 设计 3-5 个视觉分支，用于 UI 展示
3. 每个域包含：id（kebab-case）、name（中文）、description、visualBranch、order
4. 域划分要覆盖主题的主要方面，避免重叠

### Step 3：设计类型系统
1. 优先复用基础 11 种节点类型
2. 只有主题特定的概念才新增节点类型
3. 优先复用基础 12 种边类型
4. 每种节点类型包含：type、singular（只放一个什么）、forbidden（禁止什么）、note、isGranularSensitive

### Step 4：设计栏目目录
1. 复用基础 13 个栏目（5 core + 4 conditional + 4 optional）
2. 判断是否需要新增主题特定栏目
3. 每个栏目包含：type、label、definition、coverage、appliesTo、order

### Step 5：设计提示词
1. 基于 FMCW 提示词模板，替换主题相关内容
2. ReAct 提示词包含：ReAct 循环指令 + 节点粒度硬约束 + 栏目填充要求
3. topicAppendix 说明主题特定的知识范围

### Step 6：设计初始化策略
1. rootNode：根节点 id/name/shortFact
2. MVP 参数：15-30 节点、2-3 轮 ReAct、只填 definition、2-5 分钟
3. 完整开发参数：80-150 节点、6-24 轮 ReAct、根节点 25-35 分钟、25-40 分钟

### Step 7：校验+修复
1. 检查必填字段是否完整
2. 检查域数量与 validation.domainCount 一致
3. 检查视觉分支数量与 validation.visualBranchCount 一致
4. 检查每个域的 visualBranch 是否在 visualBranches 列表中
5. 不符合则让 LLM 修复，最多 3 轮

## 输出
- 完整的 TaskProfile 对象
- profiles/<topic>.ts 文件

## 验证标准
- [ ] 域数量在 3-8 范围内
- [ ] 视觉分支数量在 3-5 范围内
- [ ] 节点类型在 8-15 范围内
- [ ] 边类型在 8-15 范围内
- [ ] 栏目包含基础 13 个
- [ ] 所有必填字段完整
- [ ] 校验通过（0 个未解决问题）

## 常见问题
| 问题 | 解决方案 |
| --- | --- |
| 域划分过粗 | 拆分为更细的域，参考 FMCW 的 11 域结构 |
| 域划分过细 | 合并相关域，保持 3-8 个 |
| 节点类型不符合主题 | 新增主题特定类型，但优先复用基础类型 |
| 提示词质量差 | 参考 FMCW 提示词模板，增加节点粒度约束的正例/反例 |
