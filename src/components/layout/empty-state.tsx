import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" type="button" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
