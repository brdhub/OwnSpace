import type { Application } from "@/db/schema";

type LinkSource = Pick<Application, "id" | "company" | "role" | "applicationUrl">;

export function buildApplicationLinks(applications: LinkSource[]) {
  return applications.flatMap(({ id, company, role, applicationUrl }) => {
    if (!applicationUrl?.trim()) return [];
    try {
      const url = new URL(applicationUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") return [];
      return [{ id, company, role, href: url.href }];
    } catch {
      return [];
    }
  });
}
