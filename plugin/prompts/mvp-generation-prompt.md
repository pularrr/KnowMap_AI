# MVP 生成提示词

输入：{{topic}}、{{profile_json}}、{{references}}。输出：{topic,profile,network}，network 包含 nodes、cardBlocks、relations，可有 evidence。

为主题生成最小可评审网络，优先展示范围与组织方向。根和域沿用 Profile；新增具体节点只放一个概念、方法或问题。15–30节点是参考，不是硬性通过条件。前2–3轮结束，不继续逐节点深挖；只做少量浅搜索并明确来源是否核验。

节点字段：id/canonicalName/shortFact/nodeType/parentId，可有 domainId/order；根 parentId=""。卡片块字段：nodeId/type/title/text，MVP 只写 definition。关系字段：sourceId/targetId/type/rationale，PART_OF 指向整体（子→父）。保持所有引用可解析。

摘要建议80字内，名称20字内。多方法拆成独立节点，problem 不混入方法。给用户展示域树、2–3张卡和未确定范围，等待对方向的确认，不擅自启动完整研究。
