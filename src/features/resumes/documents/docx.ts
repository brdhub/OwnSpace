import { Document, Packer, Paragraph, TextRun, ExternalHyperlink, BorderStyle, AlignmentType } from 'docx';
import { resumeDocumentSchema, type ResumeDocument } from './model';

export function safeDocumentLink(value: string): string | null {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}

export async function generateResumeDocx(value: ResumeDocument): Promise<Buffer> {
  const document = resumeDocumentSchema.parse(value);
  const children: Paragraph[] = [];
  const text = (value: string, bold = false) => new TextRun({ text: value, bold });
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: document.profile.name || '姓名待补充', bold: true, size: 36 })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [text([document.targetRole, document.profile.phone, document.profile.email, document.profile.city].filter(Boolean).join(' · '))] }));
  function linkParagraph(link: string) {
    const safe = safeDocumentLink(link);
    return new Paragraph({ children: safe ? [new ExternalHyperlink({ link: safe, children: [new TextRun({ text: link, style: 'Hyperlink' })] })] : [text(link)] });
  }
  if (document.profile.link) children.push(linkParagraph(document.profile.link));
  for (const section of document.sections) {
    const items = section.items.filter(item => !item.hidden);
    if (section.hidden || !items.length) continue;
    children.push(new Paragraph({ keepNext: true, spacing: { before: 240, after: 100 }, border: { bottom: { style: BorderStyle.SINGLE, size: 5, color: 'CBD5E1' } }, children: [new TextRun({ text: section.title, bold: true, size: 25 })] }));
    for (const item of items) {
      children.push(new Paragraph({ keepNext: !!(item.body || item.link), spacing: { before: 90, after: 60 }, children: [text([item.title, item.organization !== item.title ? item.organization : '', item.role, item.dateRange].filter(Boolean).join(' · '), true)] }));
      if (item.link) children.push(linkParagraph(item.link));
      for (const line of item.body.split('\n')) children.push(new Paragraph({ children: [text(line)], spacing: { after: 65 }, widowControl: true }));
    }
  }
  return Packer.toBuffer(new Document({ creator: 'OwnSpace', title: `${document.profile.name} · ${document.targetRole}`, styles: { default: { document: { run: { font: 'Microsoft YaHei', size: 21 }, paragraph: { spacing: { line: 300 } } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, bottom: 850, left: 1000, right: 1000 } } }, children }] }));
}
