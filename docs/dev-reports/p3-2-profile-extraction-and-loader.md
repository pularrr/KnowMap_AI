# P3-2 开发报告：脚手架模板 + FMCW 第一个 Profile + Profile 加载机制

**日期**：2026-09-04
**阶段**：P3-2 脚手架模板 + FMCW 第一个 Profile + Profile 加载机制
**状态**：已完成
**提交**：b146adb → cc0a02c → f40c973 → 9a9996d → c5fba82 → 568e418（6 个 commit）

## 一、开发目标

把当前 FMCW 应用的硬编码抽取为第一个 Profile（profiles/fmcw-radar.ts），实现 Profile 加载机制，使应用可以根据 Profile 配置运行。

**FMCW 基线零退化是红线**：每步抽取后必须验证 FMCW 应用功能不变。现有代码不使用 ProfileLoader 时仍然使用硬编码配置，确保零退化。

## 二、7 步逐步抽取

### Step 1：域定义抽取（提交 b146adb）

**内容**：
- 创建 `profiles/fmcw-radar.ts`，定义 FMCW_PROFILE 对象
- 11 个域定义从 `knowledge-state.json` 抽取到 `Profile.domains`
- 5 个视觉分支定义到 `Profile.visualBranches`
- 验证配置（domainCount=11, visualBranchCount=5）写入 `Profile.validation`
- 根节点和初始化策略（MVP/完整开发参数）写入 `Profile.initialization`
- 创建 `server/profile/profile-loader.ts`：ProfileLoader 类，支持加载/缓存/获取域定义

**验证**：tsc 通过，6 项自动化测试全通过，FMCW 零退化。

### Step 2：节点类型与边类型抽取（提交 cc0a02c）

**内容**：
- 11 种节点类型抽取到 `Profile.nodeTypes`，每种含 singular/forbidden/note/isGranularSensitive
- 12 种边类型抽取到 `Profile.edgeTypes`，每种含 label/direction/description
- 节点粒度约束从 `schema.ts` 的 NODE_TYPE_SEMANTICS 同步到 Profile
- 边类型方向定义（symmetric/directed）从 `validation.ts` 的 symmetric Set 同步到 Profile

**验证**：tsc 通过。

### Step 3：栏目目录抽取（提交 f40c973）

**内容**：
- 13 个知识卡栏目抽取到 `Profile.cardSections`
- 每个栏目含 type/label/definition/coverage/appliesTo/order
- coverage 分布：core(5)/conditional(4)/optional(4)
- appliesTo：all(3) 或指定节点类型列表(10)
- 栏目定义从 `card-section-catalog.ts` 的 CARD_SECTION_CATALOG 同步核心字段
- decisionSignals/positiveExamples/negativeExamples 属于提示词层面，留在原文件（Step5 提示词抽取时处理）

**验证**：tsc 通过。

### Step 4：审查规则配置化（提交 9a9996d）

**内容**：
- `validateKnowledgeDataset` 新增 `options` 参数（ValidationOptions）
- 支持从 `Profile.validation.domainCount` / `visualBranchCount` 读取主题相关配置
- 支持 `options.domainCount` / `visualBranchCount` 直接覆盖
- 未提供 Profile 或 options 时使用 FMCW 默认值（11域、5分支），保持向后兼容
- 节点粒度 4 条规则和结构性规则保持通用共享，不随主题变化
- 新增 ValidationOptions 接口和 TaskProfile 类型导入

**验证**：tsc 通过。现有调用不传递 options 时使用默认值，FMCW 零退化。

### Step 5：提示词抽取（提交 c5fba82，含 Step 6）

**内容**：
- 创建 `profiles/prompts/fmcw-prompts.ts`，存储 FMCW 完整提示词配置
- `FMCW_REACT_PROMPT`：ReAct 深度检索提示词（含 6 条节点粒度硬约束）
- `FMCW_INGEST_PROMPTS`：四套资料接入提示词（conversation/summary/paper/document）
- `FMCW_REVIEW_PROMPT`：语义审查提示词（含节点粒度审查）
- `FMCW_FINAL_RESPONSE_PROMPT`：finalResponse 输出格式控制
- `FMCW_PROMPTS`：完整 PromptConfig 对象，含 topicAppendix
- `Profile.prompts` 引用 FMCW_PROMPTS

**验证**：tsc 通过。

### Step 6：根节点与初始数据策略（已在 Step 1 完成，提交 c5fba82）

**内容**：
- `Profile.initialization.rootNode`：fmcw 根节点定义
- `Profile.initialization.mvp`：MVP 参数（15-30节点、2-3轮ReAct、只填definition、2-5分钟）
- `Profile.initialization.full`：完整开发参数（80-150节点、6-24轮ReAct、根节点25-35分钟、25-40分钟）

### Step 7：Profile 加载机制完善 + 脚手架脚本（提交 568e418）

**ProfileLoader 完善**：
- 新增 `getNodeTypes()`/`getEdgeTypes()`/`getCardSections()`/`getPrompts()`/`getInitialization()`/`getMetadata()` 方法
- 支持获取 Profile 所有配置（域/节点类型/边类型/栏目/提示词/初始化/元数据）
- `defaultProfileLoader` 全局实例可注入到应用各层

**脚手架脚本 `scripts/create-app.mjs`**：
- 支持 `--list-profiles` 列出可用 Profile
- 支持 `--profile <id> --name <app-name>` 创建应用
- 生成完整目录结构（app/components/core/data/profiles/server/scripts/docs）
- 复制 Profile 配置文件
- 生成 package.json/tsconfig.json/README.md
- 输出后续步骤说明
- 基础版本，完整模板复制和依赖安装将在 P3-5/P3-6 完善

**验证**：tsc 通过，脚手架 `--list-profiles` 正常运行。

## 三、交付物清单

### 新增文件
| 文件 | 说明 |
| --- | --- |
| `profiles/fmcw-radar.ts` | FMCW 第一个 Profile（完整配置） |
| `profiles/prompts/fmcw-prompts.ts` | FMCW 提示词配置（ReAct/Review/finalResponse/ingest） |
| `server/profile/profile-loader.ts` | ProfileLoader 类（加载/缓存/获取所有配置） |
| `scripts/create-app.mjs` | 应用脚手架脚本 |

### 修改文件
| 文件 | 修改内容 |
| --- | --- |
| `core/knowledge/validation.ts` | 新增 ValidationOptions，支持从 Profile 读取域数量/视觉分支数量 |

### 提交记录
| 提交 | 说明 |
| --- | --- |
| b146adb | Step1: 域定义抽取 |
| cc0a02c | Step2: 节点类型与边类型抽取 |
| f40c973 | Step3: 栏目目录抽取 |
| 9a9996d | Step4: 审查规则配置化 |
| c5fba82 | Step5+6: 提示词抽取 + 根节点与初始数据策略 |
| 568e418 | Step7: Profile 加载机制完善 + 脚手架脚本 |

## 四、FMCW Profile 完整配置概览

| 配置项 | 值 |
| --- | --- |
| Profile ID | fmcw-radar |
| 版本 | 0.1.0 |
| 域数量 | 11 |
| 视觉分支 | 5（foundation/signal/data/system/ai） |
| 节点类型 | 11（domain/problem/concept/method/algorithm/model/component/artifact/parameter/metric/application） |
| 边类型 | 12 |
| 知识卡栏目 | 13（core 5 / conditional 4 / optional 4） |
| 提示词 | react + review + finalResponse + ingest(4套) + topicAppendix |
| 根节点 | fmcw |
| MVP 参数 | 15-30节点 / 2-3轮ReAct / 只填definition / 2-5分钟 |
| 完整开发参数 | 80-150节点 / 6-24轮ReAct / 根节点25-35分钟 / 25-40分钟 |

## 五、技术决策

### 1. 渐进式抽取，每步独立 commit
- 7 步逐步抽取，每步独立 commit，可单独回退
- 每步验证 tsc 通过，确保不引入类型错误
- 现有代码不使用 ProfileLoader 时仍然使用硬编码配置，确保零退化

### 2. 配置化 vs 通用共享的边界
- **配置化**（随主题变化）：域定义、域数量、视觉分支数量、根节点、提示词
- **半配置化**（基础共享 + 可扩展）：节点类型、边类型、栏目目录
- **通用共享**（不随主题变化）：节点粒度 4 条规则、结构性规则（树/图/公式/卡片）、Agent Loop、应用架构、UI 组件

### 3. 提示词单独文件
- 提示词较长，单独存储在 `profiles/prompts/fmcw-prompts.ts`
- Profile 通过 import 引用，保持 Profile 文件简洁
- 其他主题的提示词可以放在 `profiles/prompts/<topic>-prompts.ts`

### 4. 脚手架基础版本
- 当前脚手架只生成目录结构和配置文件，不复制完整应用模板
- 完整模板复制和依赖安装将在 P3-5/P3-6 完善
- 用户可以参考 FMCW 基准应用的完整实现

## 六、验证结果

### 类型检查
```
npx tsc --noEmit
→ 退出码 0，无错误
```

### 自动化测试
```
node --test tests/agent-reliability.test.mjs
→ 6 tests, 6 pass, 0 fail
```

### 脚手架测试
```
node scripts/create-app.mjs --list-profiles
→ 正常列出 fmcw-radar Profile
```

### FMCW 零退化验证
- [x] tsc 类型检查通过
- [x] 6 项自动化测试全通过
- [x] 现有代码不使用 ProfileLoader 时仍然使用硬编码配置
- [x] validation.ts 不传递 options 时使用 FMCW 默认值（11域、5分支）
- [x] 所有现有功能不受影响

## 七、风险与限制

1. **Profile 尚未实际注入应用各层**：当前 Profile 只是配置文件，ProfileLoader 可以读取配置，但应用的 Agent、UI、API 等层尚未实际使用 Profile 配置。这是 P3-3/P3-4 的工作。
2. **脚手架是基础版本**：只生成目录结构和配置文件，不复制完整应用模板和自动安装依赖。完整版本在 P3-5/P3-6 完善。
3. **动态 Profile 尚未支持**：当前只支持内置 Profile（FMCW），P3-3 完成后支持 LLM 设计的动态 Profile。
4. **提示词尚未实际替换**：现有代码仍然使用原文件中的提示词，Profile.prompts 只是配置源。P3-3/P3-4 完成后实际替换。

## 八、下一步

进入 **P3-3：Profile 设计器（LLM 驱动）**（2-3 天）：
- 通用 LLM 根据用户的任务描述，自动设计一个完整的 TaskProfile
- 参考 FMCW Profile 作为模板
- 校验+修复循环：Profile 设计器自动检查 Profile 是否符合契约 schema
- 输出完整的 `profiles/<topic>.ts` 文件

然后是 **P3-4：知识生成器（LLM 驱动，含分布式生成）**（2-3 天）：
- 根据主题 + Profile，自动生成初始知识网络
- 复用当前的自适应 ReAct 机制，但支持 Profile 配置
- 分布式子调用

---

**报告完成时间**：2026-09-04
**报告作者**：knowmap-agent
