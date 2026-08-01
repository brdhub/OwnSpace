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
