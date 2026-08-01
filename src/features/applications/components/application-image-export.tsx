"use client";

import Image from "next/image";
import { Download, Image as ImageIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { applicationStatusMeta, type ApplicationStatus } from "@/config/application-status";
import type { Application } from "@/db/schema";
import { internshipTypeMeta, type InternshipType } from "@/features/applications/constants";

type ExportPeriod = "all" | "week" | "today";

type ApplicationImageExportProps = {
  applications: Array<Application & { interviewCount: number }>;
  onClose: () => void;
};

type ExportRow = {
  company: string;
  role: string;
  status: ApplicationStatus;
  internshipType: InternshipType;
  appliedDate: string;
};

const periodLabels: Record<ExportPeriod, string> = {
  all: "全部投递",
  week: "本周投递",
  today: "今日投递",
};

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(date = new Date()) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return toLocalDateKey(copy);
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

function generateImage(rows: ExportRow[], period: ExportPeriod) {
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
  ctx.fillText(`${toLocalDateKey()} · ${periodLabels[period]}`, 86, 104);

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
  const [period, setPeriod] = useState<ExportPeriod>("week");
  const [imageUrl, setImageUrl] = useState("");

  const rows = useMemo(() => {
    const today = toLocalDateKey();
    const weekStart = getWeekStart();

    return applications
      .filter((application) => {
        if (period === "all") {
          return true;
        }
        if (period === "today") {
          return application.appliedDate === today;
        }
        return application.appliedDate >= weekStart && application.appliedDate <= today;
      })
      .map((application) => ({
        company: application.company,
        role: application.role,
        status: application.status,
        internshipType: application.internshipType,
        appliedDate: application.appliedDate,
      }));
  }, [applications, period]);

  function handleGenerate() {
    setImageUrl(generateImage(rows, period));
  }

  return (
    <Card className="border-teal-200 bg-teal-50/40">
      <CardHeader className="flex flex-row items-start justify-between gap-4 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-teal-700 text-white">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">投递记录导出</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">生成包含公司、岗位、实习类型和进度的图片。</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
          收起
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 border-t border-teal-100 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:w-48">
            <Label htmlFor="export-period">范围</Label>
            <Select id="export-period" value={period} onChange={(event) => setPeriod(event.target.value as ExportPeriod)}>
              <option value="all">全部</option>
              <option value="week">本周</option>
              <option value="today">今日</option>
            </Select>
          </div>
          <Button type="button" onClick={handleGenerate} className="bg-teal-700 text-white hover:bg-teal-800">
            <ImageIcon className="h-4 w-4" />
            生成图片
          </Button>
          {imageUrl ? (
            <Button asChild type="button" variant="outline">
              <a href={imageUrl} download={`ownspace-${period}-${toLocalDateKey()}.png`}>
                <Download className="h-4 w-4" />
                下载
              </a>
            </Button>
          ) : null}
        </div>
        {imageUrl ? (
          <div className="overflow-hidden rounded-lg border border-border bg-background p-3">
            <Image src={imageUrl} alt="投递记录导出预览" width={1200} height={640} unoptimized className="w-full rounded-md" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

