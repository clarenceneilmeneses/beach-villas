import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ExternalLink, Eye } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { METHOD_LABEL, niceDateTime, php } from "@/lib/format";
import { signedUrl } from "@/lib/supabase";

type ReceiptPayment = { id: string; receipt_path: string | null; amount: number; method: string; created_at: string; created_by?: string | null };

/** "View receipt": the guest's screenshot in a modal, so staff never leave the booking. */
export function ViewReceiptButton({ payment, size = "sm" }: { payment: ReceiptPayment; size?: "sm" | "default" }) {
  const [open, setOpen] = useState(false);
  const url = useQuery({
    queryKey: ["receipt-url", payment.receipt_path],
    enabled: open && !!payment.receipt_path,
    queryFn: () => signedUrl(payment.receipt_path),
    staleTime: 30 * 60 * 1000,
  });
  if (!payment.receipt_path) return null;
  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)}>
        <Eye className="size-4" /> View receipt
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Receipt · {php(payment.amount)} {METHOD_LABEL[payment.method]}</DialogTitle>
            <DialogDescription>Sent {niceDateTime(payment.created_at)}{payment.created_by ? ` by ${payment.created_by}` : ""}</DialogDescription>
          </DialogHeader>
          {url.isLoading || !url.data ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : (
            <img src={url.data} alt="Payment receipt" className="max-h-[70dvh] w-full rounded-2xl border border-border/70 bg-secondary/40 object-contain" />
          )}
          {url.data && (
            <a href={url.data} target="_blank" rel="noreferrer" className="link-action inline-flex items-center gap-1 self-start text-sm">
              Open full size <ExternalLink className="size-3.5" />
            </a>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
