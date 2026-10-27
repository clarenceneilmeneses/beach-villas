import type { ReactNode } from "react";
import { ClipboardList, RefreshCw } from "@/components/icons";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

/** Malaya's empty, error and loading states, without the pet. */
function StateShell({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
          <ClipboardList className="size-5" />
        </span>
        <h3 className="font-display text-lg text-foreground">{title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", message = "Records appear here once the day starts.", action }: { title?: string; message?: string; action?: ReactNode }) {
  return <StateShell title={title} message={message} action={action} />;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const detail = error instanceof Error ? error.message : String(error ?? "");
  const missing = /does not exist|Could not find the table|schema cache/i.test(detail);
  return (
    <StateShell
      title={missing ? "The database isn't set up yet" : "We couldn't load this section"}
      message={missing ? "Run supabase/schema.sql in the Supabase SQL Editor, then reload." : "Something went wrong reaching the database."}
      action={
        <>
          {detail && <p className="max-w-md break-words font-mono text-xs text-muted-foreground">{detail}</p>}
          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="mt-1 gap-2">
              <RefreshCw className="size-4" /> Retry
            </Button>
          )}
        </>
      }
    />
  );
}
