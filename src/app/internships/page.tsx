import { PageContainer } from "@/components/layout/page-container";
import { InternshipWorkspace } from "@/features/internships/components/internship-workspace";
import { getInternshipWorkspaceData } from "@/features/internships/queries";
import { getJournalEntryByDate, getJournalSidebarGroups } from "@/features/journal/queries";
import { toDateInputValue } from "@/lib/date";

export const dynamic = "force-dynamic";

type InternshipsPageProps = {
  searchParams: Promise<{
    id?: string;
    view?: string;
    date?: string;
  }>;
};

function normalizeRecordId(value: string | undefined) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

function normalizeDate(value: string | undefined, today: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : today;
}

export default async function InternshipsPage({ searchParams }: InternshipsPageProps) {
  const params = await searchParams;
  const today = toDateInputValue();
  const journalActive = params.view === "journal";
  const selectedDate = normalizeDate(params.date, today);
  const [data, journalGroups, journalEntry] = await Promise.all([
    getInternshipWorkspaceData(normalizeRecordId(params.id)),
    getJournalSidebarGroups(),
    journalActive ? getJournalEntryByDate(selectedDate) : Promise.resolve(null),
  ]);

  return (
    <PageContainer title="实习记录" description="留下在企业中学习、实践和成长的过程。">
      <InternshipWorkspace
        {...data}
        today={today}
        journalActive={journalActive}
        journalGroups={journalGroups}
        journalEntry={journalEntry}
        selectedJournalDate={selectedDate}
      />
    </PageContainer>
  );
}
