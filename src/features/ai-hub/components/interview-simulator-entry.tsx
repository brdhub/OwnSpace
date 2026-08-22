import { MessagesSquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApplicationAiContext } from "@/features/applications/jd-context";

type InterviewSimulatorEntryProps = {
  context: ApplicationAiContext | null;
  contextError?: string;
};

export function InterviewSimulatorEntry({ context, contextError }: InterviewSimulatorEntryProps) {
  return (
    <section id="interview-simulator" className="scroll-mt-6 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">面试准备</h2>
        <Badge variant="outline">规划中</Badge>
      </div>
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>基于 JD 的面试模拟</CardTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">未来可把岗位描述与选定简历内容组合成面试问答练习。</p>
            </div>
          </div>
          <Sparkles className="h-5 w-5 text-primary/60" />
        </CardHeader>
        <CardContent>
          {context ? (
            <div className="mb-4 rounded-md border border-border/70 bg-background/70 p-3">
              <p className="text-xs text-muted-foreground">当前关联投递</p>
              <p className="mt-1 font-medium text-foreground">{context.company} · {context.role}</p>
            </div>
          ) : contextError ? (
            <p className="mb-4 rounded-md border border-border bg-background/70 p-3 text-sm text-muted-foreground">{contextError}</p>
          ) : (
            <p className="mb-4 rounded-md border border-border bg-background/70 p-3 text-sm text-muted-foreground">从带有 JD 的投递记录进入后，这里会显示对应公司与岗位。</p>
          )}
          <Button type="button" disabled>后续版本开放</Button>
        </CardContent>
      </Card>
    </section>
  );
}
