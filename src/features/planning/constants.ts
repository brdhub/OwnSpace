export const planningStartDate = "2026-07-01";
export const planningEndDate = "2027-06-30";

export const planningEventTypes = ["task", "progress"] as const;
export const planningEventStatuses = ["todo", "inProgress", "done", "archived"] as const;
export const planningEventSources = ["system", "user"] as const;

export const planningEventTypeMeta = {
  task: {
    label: "任务",
    dotClassName: "border-amber-500 bg-amber-300",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
    cardClassName: "border-amber-200 bg-amber-50/70",
  },
  progress: {
    label: "进度",
    dotClassName: "border-emerald-600 bg-emerald-400",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    cardClassName: "border-emerald-200 bg-emerald-50/70",
  },
} as const;

export const planningStatusMeta = {
  todo: { label: "待开始" },
  inProgress: { label: "进行中" },
  done: { label: "已完成" },
  archived: { label: "已归档" },
} as const;

export const planningSourceMeta = {
  system: { label: "系统预置" },
  user: { label: "用户添加" },
} as const;

export const planningDensityMeta = {
  minimal: { label: "极简", width: 780 },
  compact: { label: "紧凑", width: 1040 },
  standard: { label: "标准", width: 1320 },
  comfortable: { label: "舒展", width: 1640 },
  expanded: { label: "展开", width: 2040 },
  detailed: { label: "细看", width: 2520 },
} as const;

export const planningDensityOrder = ["minimal", "compact", "standard", "comfortable", "expanded", "detailed"] as const;

export const defaultPlanningEvents = [
  { eventDate: "2026-07-01", title: "秋招提前批启动", eventType: "task", description: "关注互联网大厂、央国企和重点公司的提前批信息，更新简历并开始集中投递。" },
  { eventDate: "2026-07-15", title: "暑期实习与转正准备", eventType: "task", description: "如果有实习，整理实习产出、项目贡献和可量化成果；如果没有实习，集中补项目与投递。" },
  { eventDate: "2026-08-01", title: "秋招正式批开始", eventType: "task", description: "大规模网申、笔试和面试开始，保持投递节奏并复盘面经。" },
  { eventDate: "2026-09-01", title: "秋招面试高峰", eventType: "task", description: "重点准备技术面、项目表达、八股基础和手撕代码。" },
  { eventDate: "2026-10-15", title: "秋招推进与补投", eventType: "task", description: "复盘前期投递和面试结果，补投仍开放的岗位。" },
  { eventDate: "2026-11-15", title: "Offer 比较与签约", eventType: "task", description: "整理 offer、薪资、城市、岗位方向、成长空间和签约风险。" },
  { eventDate: "2026-12-15", title: "秋招复盘与春招准备", eventType: "task", description: "总结秋招问题，修复简历、项目表达、算法和基础知识短板。" },
  { eventDate: "2027-02-15", title: "春招与补录开始", eventType: "task", description: "关注春招、补录、实习转正和新增岗位，重新激活投递节奏。" },
  { eventDate: "2027-03-15", title: "春招面试与论文推进", eventType: "task", description: "并行处理春招面试、毕业论文、实验和答辩准备。" },
  { eventDate: "2027-05-01", title: "毕业答辩准备", eventType: "task", description: "完成论文、答辩材料、毕业手续和入职前准备。" },
  { eventDate: "2027-06-15", title: "毕业与入职前整理", eventType: "task", description: "整理知识、项目、材料和入职准备事项，平稳过渡到下一阶段。" },
] as const;

