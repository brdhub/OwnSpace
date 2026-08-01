import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudyCheckin } from "@/db/schema";
import { StudyCheckinCard } from "@/features/study/components/study-checkin-card";
import { StudyDateNavigation } from "@/features/study/components/study-date-navigation";
import { StudyHistoryList } from "@/features/study/components/study-history-list";
import { studyCategories } from "@/features/study/constants";
import type { StudyCheckinMap, StudyDaySummary } from "@/features/study/types";
import { formatDate } from "@/lib/date";

type StudyDashboardProps = {
  selectedDate: string;
  checkins: StudyCheckinMap;
  summaries: StudyDaySummary[];
  records: StudyCheckin[];
  selectedCategory?: string;
};

export function StudyDashboard({ selectedDate, checkins, summaries, records, selectedCategory }: StudyDashboardProps) {
  const completedCount = studyCategories.filter((category) => checkins[category]?.isCompleted).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{formatDate(selectedDate)} 的学习</CardTitle>
          <CardDescription>今天勾选 {completedCount}/4 个方向。先点一下完成启动，需要时再展开补充细节。</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          四个方向都可以只打勾，不必马上填写时长或笔记；展开后仍可记录主题、数量、链接和简短复盘。
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <StudyDateNavigation selectedDate={selectedDate} summaries={summaries} />
        <div className="grid gap-4 lg:grid-cols-2">
          {studyCategories.map((category) => (
            <StudyCheckinCard key={category} date={selectedDate} category={category} entry={checkins[category]} />
          ))}
        </div>
      </div>

      <StudyHistoryList records={records} selectedCategory={selectedCategory} />
    </div>
  );
}
