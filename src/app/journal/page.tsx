import { redirect } from "next/navigation";
import { toDateInputValue } from "@/lib/date";

type JournalPageProps = {
  searchParams: Promise<{
    date?: string;
  }>;
};

function normalizeDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDateInputValue();
}

export default async function JournalPage({ searchParams }: JournalPageProps) {
  const params = await searchParams;
  redirect(`/internships?view=journal&date=${normalizeDate(params.date)}`);
}
