import { ExternalLink, Sparkles } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aiToolGroups } from "@/config/ai-tools";

export default function AiHubPage() {
  return (
    <PageContainer title="AI 工具">
      <div className="space-y-6">
        {aiToolGroups.map((group) => (
          <section key={group.title} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{group.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.tools.map((tool) => (
                <a key={tool.url} href={tool.url} target="_blank" rel="noreferrer" className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className="h-full transition-colors hover:border-primary/60 hover:bg-accent/40">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base">{tool.name}</CardTitle>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-6 text-muted-foreground">{tool.description}</p>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
