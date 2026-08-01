import type { Application, InterviewNote, InterviewTag } from "@/db/schema";
import type { InterviewResult, InterviewRound } from "@/features/interviews/constants";

export type InterviewQuestionView = {
  id: number;
  question: string;
  myAnswer: string;
  betterAnswer: string;
  sortOrder: number;
};

export type InterviewNoteView = InterviewNote & {
  round: InterviewRound;
  result: InterviewResult;
  questions: InterviewQuestionView[];
  tags: InterviewTag[];
};

export type InterviewFormOptions = {
  applications: Application[];
  tags: InterviewTag[];
};