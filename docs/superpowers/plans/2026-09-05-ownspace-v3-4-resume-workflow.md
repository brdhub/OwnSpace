# 简历制作闭环实施计划

> 使用 subagent-driven-development 执行独立任务并审查；主任务负责集成和发布验证。

目标：实现已确认设计文档中的 P0，并试接 LangGraph 优化子流程。
规格：../specs/2026-09-05-ownspace-v3-4-resume-workflow-design.md
架构：模块化单体，SQLite 持久化，Next.js 服务端操作，纯文档模型供编辑与导出共享。

## 全局约束

- 不实现需求—证据矩阵，不增加额外模型评审请求。
- 无 API Key 可手动完成；AI 只修改被选中的条目。
- 草稿可修改，版本不可变；任务删除不删除版本。
- 有输入 revision、保存幂等键和运行占用，避免过期及重复写入。
- 本轮在 codex/resume-workflow-v3-4 分支工作，保持用户现有文件；不发布或推送。

## 任务 1：文档模型和数据持久化

- [x] 写组装、联系方式校验、旧格式兼容与快照隔离测试并观察失败。
- [x] 建立 documents/model.ts：ResumeDocument {schemaVersion:1, templateVersion:'classic-v1', targetRole, jdText, profile:{name,phone,email,city,link}, sections:[{id,type,title,hidden,items:[{id,title,organization,role,dateRange,link,body,hidden,sourceEntryId,sourceSuggestionId}]}]}。
- [x] buildResumeDocument 从素材和建议组装，只采用 revision 相符的 accepted 建议；readResumeDocument 兼容历史输出。
- [x] 建立数据库迁移与 documents/service.ts，支持草稿条件保存、幂等版本、历史复制与独立导出。
- [x] 用临时 SQLite 验证迁移保留与任务删除后的版本留存。

## 任务 2：制作、预览和导出界面

- [x] documents/editor.tsx、preview.tsx 与 docx.ts 共享模型，明确保存与未保存离开提示。
- [x] profile 编辑、分区与条目排序/显隐、正文编辑、历史列表。
- [x] /resumes/documents/[taskId] 制作；/resumes/versions、/resumes/versions/[id]、/resumes/versions/[id]/print、/resumes/versions/[id]/download。
- [x] DOCX 真实内容检查与 HTTP(S) 链接限制；打印视图提供长内容自然分页样式。

## 任务 3：岗位与 AI 流程集成

- [x] 手动保存任务、选材与制作入口，未保存输入拦截；中文字段名。
- [x] 建议撤销、inputRevision 校验、旧建议失效与重新运行失败保留。
- [x] 优化图准备/生成/校验；应用层持久运行记录，单次最多两次模型请求。
- [x] 增加超时、重复执行和迟到结果测试；保持旧用例通过。

## 任务 4：验证与收尾

- [x] 审查规范覆盖与代码质量，修复发现的问题。
- [x] `npm run typecheck`、`npm run lint`、`npm test`。
- [ ] `npm run build`：受限环境触发 Node 子进程 `spawn EPERM`，待普通本地终端复核。
- [x] 备份真实数据库后迁移。
- [ ] 浏览器级手动流程与打印页面视觉验收。
- [x] 更新 README、工程约束、版本 3.4.0 与发布说明，记录真实验证和限制。

## 实施记录

- 基线：65 项简历测试通过；沙箱子进程受限，已通过外部执行重新验证。
- 决定：保留当前目录，使用功能分支隔离；不复制依赖和个人数据库到其他工作树。
- 完成：`npm test` 108/108 通过；`npm run typecheck` 与 `npm run lint` 通过；数据库迁移在真实 `data/ownspace.db` 上成功并可重复执行。
- 限制：本机受限环境执行 Next.js 生产构建时触发 Node 子进程 `spawn EPERM`，需在普通本地终端完成 `npm run build` 复核。
- 限制：本轮未做浏览器级视觉回归，已通过共享预览模型、打印样式与导出单元测试覆盖核心输出。
