import { redirect } from "next/navigation";

type OpportunitiesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OpportunitiesPage({ searchParams }: OpportunitiesPageProps) {
  const rawParams = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["query", "companyType", "city", "unrestrictedMajor"]) {
    const value = rawParams[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  redirect(`/resumes/opportunities${params.size ? `?${params.toString()}` : ""}`);
}
