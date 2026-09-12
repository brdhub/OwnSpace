import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden"><Sidebar /></div>
      <main className="lg:pl-64 print:!pl-0">{children}</main>
    </div>
  );
}
