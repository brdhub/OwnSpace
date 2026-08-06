export const appReleases = [
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
