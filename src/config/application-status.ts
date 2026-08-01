export const applicationStatuses = [
  "planned",
  "applied",
  "assessment",
  "firstInterview",
  "laterInterview",
  "offer",
  "closed",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

type ApplicationStatusMeta = {
  label: string;
  className: string;
  summaryClassName: string;
  cardClassName: string;
  canvasBg: string;
  canvasText: string;
};

export const applicationStatusMeta: Record<ApplicationStatus, ApplicationStatusMeta> = {
  planned: {
    label: "\u8ba1\u5212\u4e2d",
    className: "border-violet-300 bg-violet-100 text-violet-800",
    summaryClassName: "border-violet-200 bg-violet-50 text-violet-900",
    cardClassName: "border-violet-200 bg-violet-50/70",
    canvasBg: "#ede9fe",
    canvasText: "#5b21b6",
  },
  applied: {
    label: "\u5df2\u6295\u9012",
    className: "border-blue-300 bg-blue-100 text-blue-800",
    summaryClassName: "border-blue-200 bg-blue-50 text-blue-900",
    cardClassName: "border-blue-200 bg-blue-50/70",
    canvasBg: "#dbeafe",
    canvasText: "#1d4ed8",
  },
  assessment: {
    label: "\u7b14\u8bd5\u6d4b\u8bc4",
    className: "border-orange-300 bg-orange-100 text-orange-800",
    summaryClassName: "border-orange-200 bg-orange-50 text-orange-900",
    cardClassName: "border-orange-200 bg-orange-50/70",
    canvasBg: "#ffedd5",
    canvasText: "#c2410c",
  },
  firstInterview: {
    label: "\u4e00\u9762",
    className: "border-cyan-300 bg-cyan-100 text-cyan-800",
    summaryClassName: "border-cyan-200 bg-cyan-50 text-cyan-900",
    cardClassName: "border-cyan-200 bg-cyan-50/70",
    canvasBg: "#cffafe",
    canvasText: "#0e7490",
  },
  laterInterview: {
    label: "\u540e\u7eed\u9762\u8bd5",
    className: "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-800",
    summaryClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
    cardClassName: "border-fuchsia-200 bg-fuchsia-50/70",
    canvasBg: "#fae8ff",
    canvasText: "#a21caf",
  },
  offer: {
    label: "Offer",
    className: "border-emerald-300 bg-emerald-100 text-emerald-800",
    summaryClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
    cardClassName: "border-emerald-200 bg-emerald-50/70",
    canvasBg: "#dcfce7",
    canvasText: "#047857",
  },
  closed: {
    label: "\u5df2\u7ed3\u675f",
    className: "border-rose-300 bg-rose-100 text-rose-800",
    summaryClassName: "border-rose-200 bg-rose-50 text-rose-900",
    cardClassName: "border-rose-200 bg-rose-50/70",
    canvasBg: "#ffe4e6",
    canvasText: "#be123c",
  },
};