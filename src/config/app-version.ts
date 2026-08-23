export const appReleases = [
  {
    version: "3.2",
    updatedAt: "2026年8月23日",
    updatedAtIso: "2026-08-23",
    notes: [
      "首页新增推荐投递滚动栏，集中展示最新且尚未加入计划的秋招机会。",
      "推荐机会支持快速进入企业筛选，并兼顾键盘操作与减少动态效果设置。",
      "更新指定飞书秋招企业库的本地只读快照。",
    ],
  },
  {
    version: "3.1",
    updatedAt: "2026年8月20日",
    updatedAtIso: "2026-08-20",
    notes: [
      "启动时可检查 OwnSpace 官方 GitHub Release，并由用户确认后再升级。",
      "新增一键离线升级包，方便无法在线检查更新的设备。",
      "升级前自动备份数据库、简历附件、本机配置与旧程序文件。",
      "迁移、构建或健康检查失败时自动恢复旧程序和旧数据库。",
    ],
  },
  {
    version: "2.3",
    updatedAt: "2026年8月7日",
    updatedAtIso: "2026-08-07",
    notes: [
      "重构结构化简历仓库，按项目、实习、教育、技能与荣誉保存专属字段。",
      "移除完成度字段，支持技术栈、职责、内容与标签等更清晰的简历素材管理。",
      "新增结构化条目详情视图，分层展示关键信息、正文、技术栈与标签。",
      "提升 PDF 上传容量，并增强 DeepSeek 结构化响应的兼容性。",
    ],
  },
  {
    version: "2.2",
    updatedAt: "2026年8月6日",
    updatedAtIso: "2026-08-06",
    notes: [
      "新增秋招企业入口，支持从指定飞书表格手动只读同步。",
      "支持按公司、岗位、企业类型、城市和专业限制筛选机会。",
      "收藏企业后可生成计划中的投递记录。",
      "投递时自动预填公司、岗位、渠道、日期与投递网址。",
    ],
  },
  {
    version: "2.1",
    updatedAt: "2026年8月3日",
    updatedAtIso: "2026-08-03",
    notes: [
      "简历仓库采用更紧凑的左右分栏布局。",
      "JD 匹配增加完整性校验与稳定的默认选材。",
      "开放针对 JD 的条目描述优化与建议审核。",
      "修复 Windows 更新依赖时的文件占用问题。",
      "历史更新日志支持点击外部或按 Esc 收起。",
      "首页日历新增每日投递数量标记。",
    ],
  },
  {
    version: "2.0",
    updatedAt: "2026年8月2日",
    updatedAtIso: "2026-08-02",
    notes: [
      "新增简历 PDF 上传、文本解析与原件管理。",
      "接入 DeepSeek 生成并审核结构化候选条目。",
      "新增正式简历条目去重与 JD 匹配选材。",
    ],
  },
] as const;

export const appRelease = appReleases[0];
export const appVersion = appRelease.version;
export const appUpdatedAt = appRelease.updatedAt;
