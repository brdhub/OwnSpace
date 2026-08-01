import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { studyCategoryMeta, type StudyCategory } from "@/features/study/constants";

type TodayStudyCardProps = {
  completed: number;
  categories: Array<{ category: StudyCategory; completed: boolean }>;
};

export function TodayStudyCard({ completed, categories }: TodayStudyCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>今日学习</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">已完成 {completed}/4 个方向</div>
            <div className="text-sm text-muted-foreground">按自己的节奏推进就好</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((item) => (
            <div key={item.category} className="rounded-md border border-border bg-background px-2 py-1.5 text-xs">
              <span className={item.completed ? "text-emerald-700" : "text-muted-foreground"}>{item.completed ? "已记录" : "未记录"}</span>
              <div className="mt-0.5 truncate text-foreground">{studyCategoryMeta[item.category].name}</div>
            </div>
          ))}
        </div>
        <Button asChild variant={completed > 0 ? "outline" : "default"}>
          <Link href="/study">打开学习记录</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
