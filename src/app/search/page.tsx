import { PageContainer } from "@/components/layout/page-container";
import { SearchWorkspace } from "@/features/search/components/search-workspace";
import { searchOwnSpace } from "@/features/search/queries";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const results = await searchOwnSpace(query);

  return (
    <PageContainer title="搜索结果" description="在投递、面试、日记、学习和长期规划里快速找回线索。">
      <SearchWorkspace query={query} results={results} />
    </PageContainer>
  );
}
