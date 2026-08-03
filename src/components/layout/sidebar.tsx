"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { appRelease, appReleases } from "@/config/app-version";
import { navigationItems } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const releaseNotesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!releaseNotesOpen) return;

    const closeOutside = (event: PointerEvent) => {
      if (!releaseNotesRef.current?.contains(event.target as Node)) {
        setReleaseNotesOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReleaseNotesOpen(false);
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [releaseNotesOpen]);

  return (
    <aside className="border-border bg-card/80 lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-r">
      <div className="flex h-full flex-col">
        <div className="px-5 py-5">
          <div ref={releaseNotesRef} className="relative w-fit pr-8">
            <Link href="/" className="block">
              <div className="text-xl font-semibold tracking-normal text-foreground">OwnSpace</div>
            </Link>
            <button
              type="button"
              className="absolute -bottom-0.5 right-0 rounded px-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={`查看 ${appRelease.updatedAt} 更新日志`}
              aria-expanded={releaseNotesOpen}
              aria-controls="ownspace-release-notes"
              onClick={() => setReleaseNotesOpen((open) => !open)}
            >
              v{appRelease.version}
            </button>
            {releaseNotesOpen ? (
              <section
                id="ownspace-release-notes"
                className="absolute left-0 top-full z-50 mt-3 w-72 rounded-lg border border-border bg-card p-4 shadow-lg"
                aria-label="OwnSpace 历史更新日志"
              >
                <h2 className="text-sm font-semibold text-foreground">历史更新日志</h2>
                <div className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-1">
                  {appReleases.map((release) => (
                    <section key={release.version} aria-labelledby={`release-${release.version}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 id={`release-${release.version}`} className="text-xs font-semibold text-foreground">v{release.version}</h3>
                        <time dateTime={release.updatedAtIso} className="shrink-0 text-[11px] text-muted-foreground">{release.updatedAt}</time>
                      </div>
                      <ul className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                        {release.notes.map((note) => <li key={`${release.version}-${note}`}>• {note}</li>)}
                      </ul>
                    </section>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-y border-border px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:border-y-0">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-max items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
