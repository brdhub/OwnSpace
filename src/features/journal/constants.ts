export const journalMoodOptions = ["calm", "focused", "tired", "anxious", "hopeful", "neutral"] as const;
export const journalEnergyOptions = ["low", "medium", "high"] as const;

export type JournalMood = (typeof journalMoodOptions)[number];
export type JournalEnergyLevel = (typeof journalEnergyOptions)[number];

export const journalMoodMeta: Record<JournalMood, string> = {
  calm: "平静",
  focused: "专注",
  tired: "有点累",
  anxious: "有点焦虑",
  hopeful: "有期待",
  neutral: "普通",
};

export const journalEnergyMeta: Record<JournalEnergyLevel, string> = {
  low: "偏低",
  medium: "还可以",
  high: "比较充沛",
};