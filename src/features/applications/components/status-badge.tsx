import { Badge } from "@/components/ui/badge";
import { applicationStatusMeta, getApplicationStatusLabel, type ApplicationStatus } from "@/config/application-status";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, interviewRound }: { status: ApplicationStatus; interviewRound?: number | null }) {
  const meta = applicationStatusMeta[status];
  return <Badge variant="outline" className={cn("border font-semibold", meta.className)}>{getApplicationStatusLabel(status, interviewRound)}</Badge>;
}

