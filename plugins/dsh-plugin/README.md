# KnowMap DSH 插件

此目录是独立的 DSH 插件包，包含自己的 `package.json`、锁文件与本地依赖。它把 KnowMap 的确定性校验、脚手架和注入入口注册为 DSH 模型工具，但不属于 KnowMap Skill 的构建框架；主 Skill 不会加载它的代码、依赖或配置。DSH 加载插件后，`ctx.tools` 会把工具名称、描述和参数 schema 自动加入模型可见工具集。Profile、MVP 和 full 内容由 DSH 宿主模型直接编写，适配器不会调用项目已配置的 DeepSeek 或其他 Provider。

当前 DSH 仍处于 developer preview。本适配器固定 `@deepseek-ai/cordis 4.0.2` 和 `@deepseek-ai/dsh-tools 0.0.1-rc.1`；升级前必须重新运行类型和集成测试。先固定一个验证过的 `deepseek-ai/deepseek-harness` commit，在其源码 checkout 安装依赖并构建，再复制 `cordis.example.yml`、替换绝对路径并运行：

```sh
pnpm dsh web --patch /absolute/path/to/cordis.yml
```

`outputRoot` 必须是 KnowMap 项目根目录之外的新隔离任务目录。启动后用 `ctx.tools.schemas()` 或 DSH 工具目录确认 `knowmap_validate_profile`、`knowmap_validate`、`knowmap_create_app`、`knowmap_inject` 等工具存在。自然语言示例：

```text
在隔离目录中根据“激光雷达感知技术”直接编写 KnowMap Profile 和 MVP，调用校验工具；生成后先让我确认。不要使用项目 Provider。
```

`outputRoot` 同时限制输入与产物位置。适配器不接受任意命令或 API Key，也不注册 design/mvp/full Provider 工具。API 配置仅供应用交付后由用户自行接入。

DSH 是开发者预览版本，安装前应固定并验证具体 commit。
