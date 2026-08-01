import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TodayJournalCardProps = {
  hasEntry: boolean;
  today: string;
};

export function TodayJournalCard({ hasEntry, today }: TodayJournalCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>今日记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">{hasEntry ? "今天已有记录" : "今天还未记录"}</div>
            <div className="text-sm text-muted-foreground">{today}</div>
          </div>
        </div>
        <Button asChild variant={hasEntry ? "outline" : "default"}>
          <Link href={`/internships?view=journal&date=${today}`}>{hasEntry ? "继续编辑" : "开始记录今天"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
