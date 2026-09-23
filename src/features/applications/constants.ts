export const internshipTypes = ["daily", "summer", "autumn", "spring"] as const;
export type InternshipType = (typeof internshipTypes)[number];

export const companySizes = ["small", "medium", "large"] as const;
export type CompanySize = (typeof companySizes)[number];

export const internshipTypeMeta: Record<
  InternshipType,
  { label: string; barClassName: string; canvasColor: string }
> = {
  summer: {
    label: "暑期实习",
    barClassName: "bg-amber-400",
    canvasColor: "#f59e0b",
  },
  daily: {
    label: "日常实习",
    barClassName: "bg-emerald-500",
    canvasColor: "#10b981",
  },
  autumn: {
    label: "秋招",
    barClassName: "bg-fuchsia-500",
    canvasColor: "#d946ef",
  },
  spring: {
    label: "春招",
    barClassName: "bg-sky-500",
    canvasColor: "#0ea5e9",
  },
};

export const companySizeMeta: Record<CompanySize, { label: string; barWidthClassName: string; canvasWidth: number }> = {
  small: {
    label: "小厂",
    barWidthClassName: "w-1.5",
    canvasWidth: 6,
  },
  medium: {
    label: "中厂",
    barWidthClassName: "w-2.5",
    canvasWidth: 10,
  },
  large: {
    label: "大厂",
    barWidthClassName: "w-4",
    canvasWidth: 16,
  },
};

export const applicationCities = ["深圳", "广州", "杭州", "上海", "北京"] as const;
export const jobCategories = ["backend", "frontend", "fullstack", "ai_application", "algorithm", "testing", "operations", "client", "embedded", "product", "other"] as const;
export type JobCategory = (typeof jobCategories)[number];
export const jobCategoryLabels: Record<JobCategory, string> = {
  backend: "后端", frontend: "前端", fullstack: "全栈", ai_application: "AI 应用 / Agent",
  algorithm: "算法", testing: "测试", operations: "运维 / SRE", client: "客户端",
  embedded: "嵌入式", product: "产品", other: "其他",
};
