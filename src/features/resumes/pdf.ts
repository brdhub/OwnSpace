import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

export type PdfTextExtractionResult = {
  text: string;
  error?: string;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Unable to read this PDF.";
}

export async function extractPdfText(path: string): Promise<PdfTextExtractionResult> {
  try {
    const parser = new PDFParse({ data: await readFile(path) });
    try {
      const result = await parser.getText();
      return { text: result.text.trim() };
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    return { text: "", error: toErrorMessage(error) };
  }
}
