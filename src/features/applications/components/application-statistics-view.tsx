import { applicationStatusMeta } from "@/config/application-status";
import { internshipTypeMeta } from "@/features/applications/constants";
import type { ApplicationStatistics, StatisticsPoint } from "@/features/applications/application-statistics";

type Distribution = { label: string; count: number; color: string };

function getDistributions(statistics: ApplicationStatistics) {
  return {
    statuses: statistics.statusCounts.filter((item) => item.count > 0).map((item) => ({
      label: applicationStatusMeta[item.key].label,
      count: item.count,
      color: applicationStatusMeta[item.key].canvasText,
    })),
    types: statistics.typeCounts.filter((item) => item.count > 0).map((item) => ({
      label: internshipTypeMeta[item.key].label,
      count: item.count,
      color: internshipTypeMeta[item.key].canvasColor,
    })),
  };
}

function TrendChart({ points }: { points: StatisticsPoint[] }) {
  const max = Math.max(1, ...points.map((point) => point.count));
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-end gap-2" role="img" aria-label={`投递数量趋势：${points.map((point) => `${point.label} ${point.count} 条`).join("，")}`}>
        {points.map((point) => (
          <div key={point.label} className="flex w-14 shrink-0 flex-col items-center gap-1 text-xs">
            <span className="font-medium text-foreground">{point.count}</span>
            <div className="flex h-28 w-full items-end rounded bg-teal-50">
              <div className="w-full rounded-t bg-teal-600" style={{ height: `${point.count ? Math.max(8, point.count / max * 100) : 0}%` }} />
            </div>
            <span className="whitespace-nowrap text-muted-foreground">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionChart({ rows, total }: { rows: Distribution[]; total: number }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2 text-sm">
          <span className="truncate" title={row.label}>{row.label}</span>
          <div className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${row.label} ${row.count} 条`}>
            <div className="h-full rounded-full" style={{ width: `${row.count / total * 100}%`, backgroundColor: row.color }} />
          </div>
          <span className="text-right tabular-nums text-muted-foreground">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

export function ApplicationStatisticsView({ statistics }: { statistics: ApplicationStatistics }) {
  if (!statistics.total) {
    return <p className="rounded-lg border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">当前范围内没有投递记录，调整日期或页面筛选后再查看统计。</p>;
  }

  const { statuses, types } = getDistributions(statistics);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-border bg-background p-4 lg:col-span-2">
        <p className="text-sm text-muted-foreground">当前范围的投递记录</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-teal-800">{statistics.total} <span className="text-base font-normal">条</span></p>
      </div>
      <section className="rounded-lg border border-border bg-background p-4 lg:col-span-2" aria-labelledby="application-trend-title">
        <h3 id="application-trend-title" className="mb-4 font-semibold">数量趋势</h3>
        <TrendChart points={statistics.trend} />
      </section>
      <section className="rounded-lg border border-border bg-background p-4" aria-labelledby="application-status-title">
        <h3 id="application-status-title" className="mb-4 font-semibold">按进度</h3>
        <DistributionChart rows={statuses} total={statistics.total} />
      </section>
      <section className="rounded-lg border border-border bg-background p-4" aria-labelledby="application-type-title">
        <h3 id="application-type-title" className="mb-4 font-semibold">按招聘类型</h3>
        <DistributionChart rows={types} total={statistics.total} />
      </section>
    </div>
  );
}

export function generateStatisticsImage(statistics: ApplicationStatistics, rangeLabel: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1120;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#f8faf9";
  ctx.fillRect(0, 0, 1200, 1120);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(48, 44, 1104, 1032);
  ctx.fillStyle = "#173b36";
  ctx.font = '700 34px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText("投递统计", 86, 104);
  ctx.font = '400 18px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(rangeLabel, 86, 138);
  ctx.font = '700 42px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(`${statistics.total} 条记录`, 86, 208);

  const { statuses, types } = getDistributions(statistics);
  const drawDistribution = (title: string, rows: Distribution[], y: number) => {
    ctx.fillStyle = "#173b36";
    ctx.font = '700 22px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText(title, 86, y);
    rows.forEach((row, index) => {
      const top = y + 20 + index * 34;
      ctx.fillStyle = "#33413d";
      ctx.font = '400 17px "Microsoft YaHei", Arial, sans-serif';
      ctx.fillText(row.label, 86, top + 15);
      ctx.fillStyle = "#e7f1ee";
      ctx.fillRect(250, top, 780, 16);
      ctx.fillStyle = row.color;
      ctx.fillRect(250, top, 780 * row.count / Math.max(1, statistics.total), 16);
      ctx.fillStyle = "#33413d";
      ctx.fillText(String(row.count), 1050, top + 15);
    });
  };

  ctx.fillStyle = "#173b36";
  ctx.font = '700 22px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText("数量趋势", 86, 270);
  const points = statistics.trend;
  const max = Math.max(1, ...points.map((point) => point.count));
  const step = points.length ? 1020 / points.length : 1020;
  points.forEach((point, index) => {
    const x = 92 + index * step;
    const height = point.count / max * 120;
    ctx.fillStyle = "#0d9488";
    ctx.fillRect(x, 424 - height, Math.max(5, step - 10), height);
    ctx.fillStyle = "#33413d";
    ctx.font = '400 13px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText(String(point.count), x, 296 + (120 - height));
    if (points.length <= 15 || index % Math.ceil(points.length / 15) === 0) {
      ctx.save();
      ctx.translate(x, 432);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(point.label, 0, 0);
      ctx.restore();
    }
  });

  drawDistribution("按进度", statuses, 510);
  drawDistribution("按招聘类型", types, 795);
  ctx.fillStyle = "#8a9692";
  ctx.font = '400 15px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText("OwnSpace · 投递统计", 86, 1058);
  return canvas.toDataURL("image/png");
}
