"use client";

import { ChevronDown, ExternalLink, Link2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { Application } from "@/db/schema";
import { buildApplicationLinks } from "@/features/applications/application-links";
import { cn } from "@/lib/utils";

export function ApplicationQuickLinks({ applications }: { applications: Array<Pick<Application, "id" | "company" | "role" | "applicationUrl">> }) {
  const links = buildApplicationLinks(applications);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && detailsRef.current?.open) detailsRef.current.open = false;
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details ref={detailsRef} className="group relative">
      <summary className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
        <Link2 className="h-4 w-4" />
        投递网址
        <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{links.length}</span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <section aria-label="当前筛选范围的投递网址" className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">当前筛选范围 · {links.length} 个投递网址</div>
        {links.length ? (
          <ol className="max-h-72 overflow-y-auto p-1">
            {links.map((link, index) => (
              <li key={link.id}>
                <a href={link.href} target="_blank" rel="noopener noreferrer" title={`${link.company} · ${link.role}\n${link.href}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="shrink-0 tabular-nums text-muted-foreground">{index + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{link.company} · {link.role}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">当前筛选下没有投递网址。</p>
        )}
      </section>
    </details>
  );
}
