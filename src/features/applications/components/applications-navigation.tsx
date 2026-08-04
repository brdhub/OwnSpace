"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/applications", label: "投递记录" },
  { href: "/applications/opportunities", label: "秋招企业" },
];

export function ApplicationsNavigation() {
  const pathname = usePathname();
  return (
    <nav className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1" aria-label="投递模块导航">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
