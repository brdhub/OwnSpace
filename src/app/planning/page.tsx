import { PageContainer } from "@/components/layout/page-container";
import { PlanningWorkspace } from "@/features/planning/components/planning-workspace";
import { getPlanningEvents } from "@/features/planning/queries";
import { toDateInputValue } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const events = await getPlanningEvents();

  return (
    <PageContainer title="长期规划" description="把秋招、春招、毕业和每天的小进展放到同一条时间线上。">
      <PlanningWorkspace events={events} today={toDateInputValue()} />
    </PageContainer>
  );
}
