import Link from "next/link";
import { ExternalLink, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudyCheckin } from "@/db/schema";
import { studyCategories, studyCategoryMeta, type StudyCategory } from "@/features/study/constants";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";

type StudyHistoryListProps = {
  records: StudyCheckin[];
  selectedCategory?: string;
};

export function StudyHistoryList({ records, selectedCategory }: StudyHistoryListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
            <ListFilter className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>最近记录</CardTitle>
            <CardDescription>回看已经写下的学习片段。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/study"
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent",
              !selectedCategory ? "bg-primary text-primary-foreground hover:bg-primary" : "bg-background",
            )}
          >
            全部
          </Link>
          {studyCategories.map((category) => (
            <Link
              key={category}
              href={`/study?category=${category}`}
              className={cn(
                "rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent",
                selectedCategory === category ? "bg-primary text-primary-foreground hover:bg-primary" : "bg-background",
              )}
            >
              {studyCategoryMeta[category].name}
            </Link>
          ))}
        </div>

        {records.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
            还没有学习记录。等你愿意开始时，先写下一点今天做过的事就好。
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => {
              const category = record.category as StudyCategory;
              return (
                <div key={record.id} className="rounded-md border border-border bg-background p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{record.title || studyCategoryMeta[category].name}</span>
                        <Badge variant={record.isCompleted ? "default" : "outline"}>{record.isCompleted ? "已完成" : "已记录"}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {formatDate(record.checkinDate)} · {studyCategoryMeta[category].name}
                      </div>
                    </div>
                    {record.sourceUrl ? (
                      <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        来源
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {record.durationMinutes ? <span>{record.durationMinutes} 分钟</span> : null}
                    {record.quantity ? <span>{studyCategoryMeta[category].quantityLabel}：{record.quantity}</span> : null}
                  </div>
                  {record.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{record.notes}</p> : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
