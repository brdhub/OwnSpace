import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GlobalSearchResult } from "@/features/search/queries";

type SearchWorkspaceProps = {
  query: string;
  results: GlobalSearchResult[];
};

export function SearchWorkspace({ query, results }: SearchWorkspaceProps) {
  return (
    <div className="space-y-5">
      <form className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row" action="/search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={query} className="pl-9" placeholder="搜索公司、岗位、面试问题、日记、学习和规划" />
        </div>
        <Button type="submit">搜索</Button>
      </form>

      {!query ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm leading-6 text-muted-foreground">
          输入一个关键词，可以跨模块查找投递、面经、日记、学习记录和长期规划节点。
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm leading-6 text-muted-foreground">
          没有找到相关记录。可以换一个更短的关键词试试。
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">找到 {results.length} 条相关记录</div>
          {results.map((result) => (
            <Link key={result.id} href={result.href} className="block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">{result.module}</span>
                <span className="text-xs text-muted-foreground">{result.subtitle}</span>
              </div>
              <h2 className="mt-2 text-base font-semibold text-foreground">{result.title}</h2>
              {result.excerpt ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.excerpt}</p> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
