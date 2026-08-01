import { Badge } from "@/components/ui/badge";
import { applicationStatusMeta, type ApplicationStatus } from "@/config/application-status";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = applicationStatusMeta[status];
  return <Badge variant="outline" className={cn("border font-semibold", meta.className)}>{meta.label}</Badge>;
}

