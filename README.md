# OwnSpace

本地优先的个人职业准备助手，面向后端、全栈与 AI Agent 实习准备场景。

## 环境要求

需要 Node.js `20.16+`（20.x）或 `22.3+`。

## 本地运行

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

默认访问地址为 `http://localhost:3000`。

## 分享给朋友（Windows）

双击 `make-share-package.cmd`，脚本会在 `dist` 目录生成带时间戳的分享压缩包。压缩包只包含运行必需的源码和配置，明确不包含：

- `data` 中的个人数据库；
- `node_modules`；
- `.next-dev`、`.next-build` 等构建缓存；
- 日志和 Git 记录。

朋友需要先安装 Node.js 22 LTS，然后解压并双击 `start-ownspace.cmd`。第一次启动会自动安装依赖、执行数据库迁移、初始化系统默认项并完成生产构建，因此需要联网且可能等待几分钟。以后双击时，脚本会比较源码和现有构建的更新时间：没有变化就直接启动，有更新则先停止旧的 OwnSpace 服务、重新构建，再打开 `http://localhost:3000`。

当依赖清单发生变化时，启动器会先停止占用 3000 端口的旧 OwnSpace 服务，再执行 `npm ci`，避免 Windows 因 Next.js 原生模块仍在使用而报 `EPERM unlink next-swc...node`。如果正在用其他端口运行开发服务器，请先关闭对应终端，再双击启动器。

朋友的新数据库只包含面经技术标签和系统规划节点，不包含你的数据，也不会生成虚构投递、面经、日记或用户规划示例。

Windows PowerShell 如果提示无法加载 `npm.ps1`，请改用：

```powershell
npm.cmd install
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

`http://localhost:3000` 需要在 `npm run dev` 或 `npm.cmd run dev` 保持运行时访问。

开发服务器使用 `.next-dev` 缓存，生产构建和 `start` 使用 `.next-build`，两者不会互相覆盖。日常开发只需保持 `dev` 运行，并按需执行 `lint` 与 `typecheck`；最终验收时先关闭开发服务器，再执行 `build`，避免两个 Next.js 进程争抢 CPU 和内存。

仅在对应服务已经关闭后清理 `.next-dev` 或 `.next-build`。不要使用 `Stop-Process node` 结束所有 Node.js 进程；请关闭启动 OwnSpace 的终端，或只停止占用 3000 端口的 OwnSpace 进程。

`db:seed` 会幂等初始化面经技术标签；如果当前没有任何投递记录，会写入一条虚构投递和一条虚构面经作为示例；同时会写入少量虚构日记示例，且不会覆盖同日期已有日记。学习记录默认保持为空，由你自己从打勾开始填写。长期规划会幂等写入 2026-07 到 2027-06 的系统默认节点，并写入少量完全虚构的用户任务/进度示例；重复执行不会重复生成这些规划节点。

`db:init` 只幂等初始化系统必需的面经技术标签和系统规划节点，适合全新分享包首次启动，不写入任何用户示例记录。

如需清空本地已填写数据：

```powershell
npm.cmd run db:clear
```

## 当前模块

投递记录支持新增、查看、编辑、删除、搜索、筛选、状态更新、投递链接、面试时间和图片导出；投递类型支持日常实习、暑期实习和秋招。

面经模块支持：

- 关联投递记录；
- 添加多条面试问题；
- 为面试记录选择多个预定义技术标签；
- 按公司、岗位、轮次、结果和标签筛选；
- 从投递记录跳转查看关联面经。

日记模块支持：

- 按日期创建、查看、编辑和删除每日记录；
- 同一天只保留一篇日记；
- 通过日期侧边栏按年月回看；
- 在首页显示今日记录入口；
- 支持导出全部或当前日期日记为 Markdown。

学习模块支持：

- 按日期勾选四个固定学习方向；
- 每个方向同一天只保留一条记录；
- 默认轻量打勾，展开后可补充时长、数量、主题、链接和笔记；
- 查看最近 14 天完成概览；
- 在首页显示今日学习进度入口。

长期规划模块支持：

- 查看 2026 年 7 月到 2027 年 6 月的长期时间轴；
- 展示系统预置的秋招、春招、论文和毕业准备节点；
- 新增、编辑、删除任务节点和进度节点；
- 点击时间轴空白位置按相对位置推算日期并新增节点；
- 按任务、进度筛选，并在首页显示最近规划入口；
- 拖动缩略图视野框移动时间轴视野；
- 展开查看因缩放暂时隐藏的节点。
首页搜索支持跨投递、面试、日记、学习和长期规划查找记录。

AI 工具栏提供常用网页对话 AI 的快速入口，不需要 API Key。

简历模块的 PDF 保存、本地文字提取、手动条目管理不需要 API Key。只有点击“生成结构化条目”或“AI 推荐条目”时才会调用 DeepSeek。使用前复制 `.env.example` 为 `.env.local`，并仅在本机填写新申请的 `DEEPSEEK_API_KEY`：

```dotenv
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_TIMEOUT_MS=30000
```

不要把密钥提交到 Git、写入数据库或粘贴到前端页面。任何曾在聊天、截图或可共享文件中暴露的密钥都应先在 DeepSeek 控制台轮换，再把新密钥写入 `.env.local`。

## 常用命令

```bash
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm run build
```

除可选的简历 AI 功能外，本项目不需要 API Key、登录账号、云数据库、第三方服务或 Docker。



