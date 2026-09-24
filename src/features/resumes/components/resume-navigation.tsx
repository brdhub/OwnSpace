import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResumeTab = "vault" | "jd" | "opportunities";

const tabs: { key: ResumeTab; label: string; href: string }[] = [
  { key: "vault", label: "简历仓库", href: "/resumes" },
  { key: "jd", label: "JD 匹配", href: "/resumes?tab=jd" },
  { key: "opportunities", label: "秋招企业", href: "/resumes/opportunities" },
];

export function ResumeNavigation({ active }: { active: ResumeTab }) {
  return <nav className="mb-5 flex flex-wrap items-center gap-2 border-b border-border pb-3" aria-label="简历模块导航">
    {tabs.map(tab => <Link key={tab.key} href={tab.href} aria-current={active === tab.key ? "page" : undefined}
      className={cn(buttonVariants({ size: "sm", variant: active === tab.key ? "default" : "ghost" }))}>{tab.label}</Link>)}
    <Link href="/resumes/versions" className="ml-auto self-center text-sm text-primary underline">已保存简历</Link>
  </nav>;
}
