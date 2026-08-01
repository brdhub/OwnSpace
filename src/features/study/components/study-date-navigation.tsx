import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudyDaySummary } from "@/features/study/types";
import { formatDate, toDateInputValue } from "@/lib/date";
import { cn } from "@/lib/utils";

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

type StudyDateNavigationProps = {
  selectedDate: string;
  summaries: StudyDaySummary[];
};

export function StudyDateNavigation({ selectedDate, summaries }: StudyDateNavigationProps) {
  const today = toDateInputValue();
  const previousDate = shiftDate(selectedDate, -1);
  const nextDate = shiftDate(selectedDate, 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>学习日期</CardTitle>
            <CardDescription>{formatDate(selectedDate)}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/study?date=${previousDate}`}>
              <ChevronLeft className="h-4 w-4" />
              前一天
            </Link>
          </Button>
          <Button asChild variant={selectedDate === today ? "secondary" : "outline"} size="sm">
            <Link href={`/study?date=${today}`}>今天</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/study?date=${nextDate}`}>
              后一天
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">最近 14 天</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {summaries.map((item) => {
              const active = item.date === selectedDate;
              return (
                <Link
                  key={item.date}
                  href={`/study?date=${item.date}`}
                  className={cn(
                    "rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent",
                    active ? "border-primary bg-primary text-primary-foreground hover:bg-primary" : "bg-background",
                  )}
                >
                  <div className="font-medium">{item.date.slice(5)}</div>
                  <div className={cn("mt-1 text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{item.completedCount}/4</div>
                </Link>
              );
            })}
          </div>
        </div>

        <Badge variant="outline" className="w-fit">
          只记录已经发生的学习，不需要补齐每一天
        </Badge>
      </CardContent>
    </Card>
  );
}
