/**
 * Client-side pagination for the admin's long lists.
 *
 * WHY CLIENT-SIDE
 *
 * Every ported screen already holds its whole table in memory: the selectors in
 * `lib/obs/*-db.ts` filter, sort and total across the full set, and the KPI
 * cards above each table are sums over everything in scope, not over the page
 * being viewed. Paginating in PostgREST would mean either fetching twice (once
 * for the page, once for the totals) or showing totals that only describe the
 * current page — which is worse than a slightly larger fetch.
 *
 * So this pages the RENDERED ROWS, not the query. That keeps every total
 * honest and costs nothing while the tables are in the low thousands. When a
 * table genuinely outgrows the fetch, the fix is a server-side count plus
 * `.range()` in `admin-data.ts` — and this component's API does not change.
 *
 * The row cap that matters first is PostgREST's 1000, paged past by `allRows`
 * in `src/lib/obs/load-admin-data.ts`.
 */
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export type Pagination<T> = {
  /** Just the rows for the current page. */
  page: T[];
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  setPageSize: (n: number) => void;
  total: number;
  /** 1-based row numbers of the current page, for the "x–y of z" label. */
  from: number;
  to: number;
  canPrev: boolean;
  canNext: boolean;
  prev: () => void;
  next: () => void;
};

/**
 * Slices `rows` into pages.
 *
 * `resetKey` is what makes filtering behave: change a search term or a status
 * filter and the list shortens under you, so the view returns to page 1. Pass
 * anything that identifies the current filter set. Without it a guest on page 4
 * who then searches sees an empty table rather than their results.
 */
export function usePagination<T>(
  rows: T[],
  options?: { initialPageSize?: number; resetKey?: unknown },
): Pagination<T> {
  const [pageSize, setPageSizeRaw] = useState(options?.initialPageSize ?? 25);
  const [pageIndex, setPageIndex] = useState(0);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const resetKey = options?.resetKey;
  useEffect(() => {
    setPageIndex(0);
  }, [resetKey, pageSize]);

  // Rows can disappear beneath the current page — a booking is cancelled, a
  // filter narrows — which would otherwise leave the viewer on a blank page.
  useEffect(() => {
    setPageIndex((i) => Math.min(i, pageCount - 1));
  }, [pageCount]);

  const safeIndex = Math.min(pageIndex, pageCount - 1);
  const page = useMemo(
    () => rows.slice(safeIndex * pageSize, safeIndex * pageSize + pageSize),
    [rows, safeIndex, pageSize],
  );

  return {
    page,
    pageIndex: safeIndex,
    pageCount,
    pageSize,
    setPageSize: setPageSizeRaw,
    total,
    from: total === 0 ? 0 : safeIndex * pageSize + 1,
    to: Math.min(total, safeIndex * pageSize + pageSize),
    canPrev: safeIndex > 0,
    canNext: safeIndex < pageCount - 1,
    prev: () => setPageIndex((i) => Math.max(0, i - 1)),
    next: () => setPageIndex((i) => Math.min(pageCount - 1, i + 1)),
  };
}

/**
 * The bar under a paginated table.
 *
 * Hidden entirely when everything fits on one page AND the list is short enough
 * that nobody would want a different page size — a control that can only ever
 * say "1–3 of 3" is noise.
 */
export function PaginationBar<T>({
  pagination,
  noun = "rows",
  className = "",
}: {
  pagination: Pagination<T>;
  /** Plural noun for the count label, e.g. "reservations". */
  noun?: string;
  className?: string;
}) {
  const { from, to, total, pageIndex, pageCount, pageSize, setPageSize } = pagination;

  if (total <= PAGE_SIZES[0]) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground ${className}`}
    >
      <p aria-live="polite">
        Showing{" "}
        <span className="font-medium text-foreground">
          {from}–{to}
        </span>{" "}
        of <span className="font-medium text-foreground">{total}</span> {noun}
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="hidden sm:inline">Per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="h-8 w-[4.5rem]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={pagination.prev}
            disabled={!pagination.canPrev}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[5.5rem] text-center text-xs tabular-nums">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="size-8 p-0"
            onClick={pagination.next}
            disabled={!pagination.canNext}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
