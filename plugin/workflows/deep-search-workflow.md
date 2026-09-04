# 工作流 5：深度检索工作流

## 目标
基于当前节点进行深度知识检索，自适应扩展知识网络。

## 触发条件
- 用户点击"深度检索"按钮
- 用户要求"深入研究这个节点"
- 完整开发阶段的自适应 ReAct

## 输入
- 起始节点（根节点或指定节点）
- Profile
- 当前知识网络
- LLM 配置

## 参数
- maxRounds：min(LLM_MAX_TOOL_ROUNDS||8, 8)
- 逐节点 ReAct 计数重置
- 预算自适应（稀疏图谱更多轮次）
- 根节点预算：25-35 分钟

## 步骤

### Step 1：初始化
1. 确定起始节点
2. 加载 Profile 配置
3. 初始化 ReAct 循环状态
4. 设置预算上限

### Step 2：ReAct 循环
每轮执行：

#### 2.1 Observe（观察）
1. 读取当前节点及直接子节点
2. 读取当前节点的知识卡，评估栏目覆盖度
3. 遍历图谱（traverse_graph，maxDepth:2, maxNodes:18）
4. 评估覆盖度（assess_coverage）
5. compactObservation（outputLimit=600）
6. rollingContext（keep=6）

#### 2.2 Judge（判断缺口）
1. 判断当前节点缺少哪些栏目
2. 判断缺少哪些子节点或相关节点
3. 优先比较同层解决方案，再深入子问题和依赖
4. 定义、原理、假设、正反例、工程取舍、验证、实现、应用与研究均需考察

#### 2.3 Act（行动）
1. 深入一个尚未解决的问题
2. 输出一批实质知识（新节点、卡片块、关系）
3. 可调用 web_search 收集外部证据
4. finalResponse 两阶段：
   - 阶段 1：web_search 收集证据
   - 阶段 2：纯文本 JSON 输出
5. 空响应自动重试（最多 3 次）

#### 2.4 Merge（批量合并）
1. 收集所有候选后统一比对
2. 不要逐条调用图内查重工具
3. 新增节点可引用本批或此前批次新节点 ID 作为父级
4. 按 id/名称去重节点
5. 按 nodeId+type 去重卡片
6. 按 source+target+type 去重关系

#### 2.5 Review（审查）
1. 语义审查：节点粒度、栏目匹配、来源可验证
2. 结构校验：边端点存在、域归属正确
3. 语义审查 fail-open：解析失败降级为 warning
4. hardReview 仍严格把关

### Step 3：收敛判断
1. 连续两轮新增很少（<2 节点）时收敛
2. 达到该节点预算上限时停止
3. 达到全局节点数目标时停止
4. 只有连续多轮没有实质新增时才标记收敛

### Step 4：输出
1. 生成完整的知识候选文档
2. 包含 answer、coverageAssessment、converged、gaps、proposal
3. proposal 包含 newNodes、cardBlocks、relations、evidence

## 输出
- 扩展后的知识网络
- 新增节点列表
- 新增卡片块列表
- 新增关系列表
- 覆盖度评估报告

## 验证标准
- [ ] ReAct 循环正常执行（无无效结构化输出）
- [ ] 节点符合"一个节点一个概念"约束
- [ ] 知识卡栏目填充率 >50%
- [ ] 关系合理（父子关系 + 跨节点语义关系）
- [ ] 收敛判断正确（不提前收敛、不无限循环）
- [ ] 上下文管理有效（不超出窗口）
- [ ] finalResponse 输出格式正确（合法 JSON）

## 常见问题
| 问题 | 解决方案 |
| --- | --- |
| ReAct 返回无效结构化输出 | finalResponse 两阶段（web_search→纯文本JSON）+ 空响应重试 |
| 上下文超出窗口 | compactObservation(outputLimit=600) + rollingContext(keep=6) |
| 提前收敛 | 提高收敛阈值（<2→<1），增加最小轮次 |
| 无限循环 | 设置预算上限（根节点 25-35 分钟），达到即停止 |
| 节点粒度不合规 | 语义审查 + 节点粒度 4 条规则 + 提示词约束 |
| 重复节点多 | 批量合并而非逐个查重，按 id/名称去重 |
| 推理模型 tool_choice 报错 | isReasoningModel 剥离 tool_choice + parallel_tool_calls，自动重试 |
