"use client";

import Image from "next/image";
import { Download, Image as ImageIcon, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { applicationStatusMeta, type ApplicationStatus } from "@/config/application-status";
import type { Application } from "@/db/schema";
import { internshipTypeMeta, type InternshipType } from "@/features/applications/constants";
import { buildApplicationStatistics } from "@/features/applications/application-statistics";
import { ApplicationStatisticsView, generateStatisticsImage } from "@/features/applications/components/application-statistics-view";

type ExportPeriod = "all" | "recent7" | "today" | "custom";
type ExportView = "details" | "statistics";
const maxDetailImageRows = 100;

type ApplicationImageExportProps = {
  applications: Array<Application & { interviewCount: number; resumeAssetName: string | null }>;
  onClose: () => void;
};

type ExportRow = {
  company: string;
  role: string;
  status: ApplicationStatus;
  internshipType: InternshipType;
  appliedDate: string;
};

type ExportRange = {
  startDate: string;
  endDate: string;
  label: string;
};

const periodLabels: Record<ExportPeriod, string> = {
  all: "全部",
  recent7: "最近 7 天",
  today: "今天",
  custom: "自定义",
};

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRecent7Start(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - 6);
  return toLocalDateKey(start);
}

function getRowsDateRange(rows: ExportRow[]): ExportRange {
  const dates = rows.map((row) => row.appliedDate).sort();
  if (!dates.length) {
    return { startDate: "", endDate: "", label: "全部日期" };
  }

  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  return { startDate, endDate, label: `${startDate} 至 ${endDate}` };
}

function getExportRange(period: ExportPeriod, startDate: string, endDate: string, rows: ExportRow[]) {
  if (period === "all") {
    return getRowsDateRange(rows);
  }

  return {
    startDate,
    endDate,
    label: startDate && endDate ? `${startDate} 至 ${endDate}` : "日期范围未完整",
  };
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let next = text;
  while (next.length > 0 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}...`;
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function generateImage(rows: ExportRow[], rangeLabel: string) {
  const width = 1200;
  const rowHeight = 72;
  const height = Math.max(520, 210 + rows.length * rowHeight + 72);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return "";
  }

  ctx.fillStyle = "#f8faf9";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  drawRoundRect(ctx, 48, 44, width - 96, height - 88, 18);
  ctx.fill();

  ctx.fillStyle = "#173b36";
  ctx.font = '700 34px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(`投递记录 · ${rangeLabel}`, 86, 104);

  ctx.fillStyle = "#64706d";
  ctx.font = '400 18px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText(`共 ${rows.length} 条记录`, 86, 138);

  const tableX = 86;
  const tableY = 176;
  const tableWidth = width - 172;
  const colCompany = 270;
  const colRole = 420;
  const colType = 150;
  const colStatus = 180;

  ctx.fillStyle = "#e7f1ee";
  drawRoundRect(ctx, tableX, tableY, tableWidth, 48, 10);
  ctx.fill();

  ctx.fillStyle = "#35514d";
  ctx.font = '700 18px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText("公司", tableX + 24, tableY + 31);
  ctx.fillText("投递岗位", tableX + colCompany + 24, tableY + 31);
  ctx.fillText("类型", tableX + colCompany + colRole + 24, tableY + 31);
  ctx.fillText("进度", tableX + colCompany + colRole + colType + 24, tableY + 31);

  if (rows.length === 0) {
    ctx.fillStyle = "#7b8683";
    ctx.font = '400 22px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText("当前范围内还没有投递记录。", tableX + 24, tableY + 112);
  }

  rows.forEach((row, index) => {
    const y = tableY + 48 + index * rowHeight;
    ctx.fillStyle = index % 2 === 0 ? "#ffffff" : "#fbfdfc";
    ctx.fillRect(tableX, y, tableWidth, rowHeight);

    ctx.strokeStyle = "#e1e7e5";
    ctx.beginPath();
    ctx.moveTo(tableX, y + rowHeight);
    ctx.lineTo(tableX + tableWidth, y + rowHeight);
    ctx.stroke();

    ctx.fillStyle = "#17231f";
    ctx.font = '600 19px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText(truncateText(ctx, row.company, colCompany - 44), tableX + 24, y + 31);

    ctx.fillStyle = "#33413d";
    ctx.font = '400 18px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText(truncateText(ctx, row.role, colRole - 44), tableX + colCompany + 24, y + 31);

    const typeMeta = internshipTypeMeta[row.internshipType];
    ctx.fillStyle = typeMeta.canvasColor;
    drawRoundRect(ctx, tableX + colCompany + colRole + 24, y + 21, 10, 24, 5);
    ctx.fill();
    ctx.fillStyle = "#33413d";
    ctx.font = '600 16px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText(typeMeta.label, tableX + colCompany + colRole + 44, y + 39);

    const statusLabel = applicationStatusMeta[row.status].label;
    const statusMeta = applicationStatusMeta[row.status];
    ctx.fillStyle = statusMeta.canvasBg;
    drawRoundRect(ctx, tableX + colCompany + colRole + colType + 20, y + 17, colStatus - 36, 32, 16);
    ctx.fill();
    ctx.fillStyle = statusMeta.canvasText;
    ctx.font = '600 16px "Microsoft YaHei", Arial, sans-serif';
    ctx.fillText(statusLabel, tableX + colCompany + colRole + colType + 38, y + 39);
  });

  ctx.fillStyle = "#8a9692";
  ctx.font = '400 15px "Microsoft YaHei", Arial, sans-serif';
  ctx.fillText("OwnSpace · 投递记录导出", 86, height - 58);

  return canvas.toDataURL("image/png");
}

export function ApplicationImageExport({ applications, onClose }: ApplicationImageExportProps) {
  const [view, setView] = useState<ExportView>("details");
  const [period, setPeriod] = useState<ExportPeriod>("recent7");
  const [startDate, setStartDate] = useState(() => getRecent7Start());
  const [endDate, setEndDate] = useState(() => toLocalDateKey());
  const [imageUrl, setImageUrl] = useState("");
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    setImageUrl("");
    setExportError("");
  }, [applications]);

  const rangeError = period !== "all" && (!startDate || !endDate || startDate > endDate);

  const rows = useMemo(() => {
    return applications
      .filter((application) => period === "all" || (
        Boolean(startDate && endDate)
        && application.appliedDate >= startDate
        && application.appliedDate <= endDate
      ))
      .map((application) => ({
        company: application.company,
        role: application.role,
        status: application.status,
        internshipType: application.internshipType,
        appliedDate: application.appliedDate,
      }));
  }, [applications, endDate, period, startDate]);

  const exportRange = useMemo(
    () => getExportRange(period, startDate, endDate, rows),
    [endDate, period, rows, startDate],
  );
  const statistics = useMemo(
    () => buildApplicationStatistics(rows, exportRange.startDate, exportRange.endDate),
    [rows, exportRange.startDate, exportRange.endDate],
  );
  const detailTooLarge = view === "details" && rows.length > maxDetailImageRows;

  function clearPreview() {
    setImageUrl("");
    setExportError("");
  }

  function handlePeriodChange(nextPeriod: ExportPeriod) {
    setPeriod(nextPeriod);
    clearPreview();
    const today = toLocalDateKey();
    if (nextPeriod === "recent7") {
      setStartDate(getRecent7Start());
      setEndDate(today);
    } else if (nextPeriod === "today") {
      setStartDate(today);
      setEndDate(today);
    }
  }

  function handleStartDateChange(value: string) {
    setPeriod("custom");
    setStartDate(value);
    clearPreview();
  }

  function handleEndDateChange(value: string) {
    setPeriod("custom");
    setEndDate(value);
    clearPreview();
  }

  function handleGenerate() {
    if (rangeError || detailTooLarge) return;
    try {
      const url = view === "statistics"
        ? generateStatisticsImage(statistics, exportRange.label)
        : generateImage(rows, exportRange.label);
      if (!url.startsWith("data:image/png")) throw new Error("Canvas export failed");
      setImageUrl(url);
      setExportError("");
    } catch {
      setImageUrl("");
      setExportError("图片生成失败，请调整范围后重试。");
    }
  }

  const downloadRange = exportRange.startDate && exportRange.endDate
    ? `${exportRange.startDate}-to-${exportRange.endDate}`
    : "all-dates";

  return (
    <Card className="border-teal-200 bg-teal-50/40">
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-teal-700 text-white">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">投递导出</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">按当前页面筛选和日期范围导出明细或统计图片。</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
          收起
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-teal-100 p-4">
        <div className="flex gap-2" aria-label="导出内容">
          <Button type="button" aria-pressed={view === "details"} variant={view === "details" ? "default" : "outline"} onClick={() => { setView("details"); clearPreview(); }}>投递明细</Button>
          <Button type="button" aria-pressed={view === "statistics"} variant={view === "statistics" ? "default" : "outline"} onClick={() => { setView("statistics"); clearPreview(); }}>投递统计</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="export-period">快捷范围</Label>
            <Select id="export-period" value={period} onChange={(event) => handlePeriodChange(event.target.value as ExportPeriod)}>
              <option value="recent7">最近 7 天</option>
              <option value="today">今天</option>
              <option value="all">全部</option>
              {period === "custom" ? <option value="custom">自定义</option> : null}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="export-start-date">开始日期</Label>
            <Input id="export-start-date" type="date" value={startDate} disabled={period === "all"} onChange={(event) => handleStartDateChange(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="export-end-date">结束日期</Label>
            <Input id="export-end-date" type="date" value={endDate} disabled={period === "all"} onChange={(event) => handleEndDateChange(event.target.value)} />
          </div>
        </div>
        {rangeError ? <p className="text-sm text-destructive">结束日期不能早于开始日期，且日期范围不能为空。</p> : null}
        {detailTooLarge ? <p className="text-sm text-destructive">单张明细图片最多 100 条，请缩小日期范围或页面筛选。</p> : null}
        {exportError ? <p className="text-sm text-destructive" role="alert">{exportError}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">当前范围：{periodLabels[period]} · {exportRange.label} · 共 {rows.length} 条</p>
          <Button type="button" onClick={handleGenerate} disabled={rangeError || detailTooLarge} className="bg-teal-700 text-white hover:bg-teal-800">
            <ImageIcon className="h-4 w-4" />
            生成图片
          </Button>
          {imageUrl ? (
            <Button asChild type="button" variant="outline">
              <a href={imageUrl} download={`ownspace-applications-${view}-${downloadRange}.png`}>
                <Download className="h-4 w-4" />
                下载
              </a>
            </Button>
          ) : null}
        </div>
        {view === "statistics" && !rangeError ? <ApplicationStatisticsView statistics={statistics} /> : null}
        {imageUrl ? (
          <div className="overflow-hidden rounded-lg border border-border bg-background p-3">
            <Image src={imageUrl} alt={view === "statistics" ? "投递统计图片预览" : "投递明细图片预览"} width={1200} height={view === "statistics" ? 1120 : 640} unoptimized className="w-full rounded-md" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

