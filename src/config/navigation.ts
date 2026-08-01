import { Bot, BriefcaseBusiness, Building2, CalendarCheck, FileText, GraduationCap, LayoutDashboard, Route } from "lucide-react";

export const navigationItems = [
  { label: "首页", href: "/", icon: LayoutDashboard },
  { label: "投递记录", href: "/applications", icon: BriefcaseBusiness },
  { label: "实习记录", href: "/internships", icon: Building2 },
  { label: "面试", href: "/interviews", icon: CalendarCheck },
  { label: "学习", href: "/study", icon: GraduationCap },
  { label: "长期规划", href: "/planning", icon: Route },
  { label: "简历", href: "/resumes", icon: FileText },
  { label: "AI 工具", href: "/ai-hub", icon: Bot },
] as const;



