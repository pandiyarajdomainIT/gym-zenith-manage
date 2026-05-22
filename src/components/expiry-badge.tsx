import { Badge } from "@/components/ui/badge";
import { daysUntil, expiryState } from "@/lib/gym-utils";
import { cn } from "@/lib/utils";

export function ExpiryBadge({ expiryDate }: { expiryDate: string }) {
  const state = expiryState(expiryDate);
  const d = daysUntil(expiryDate);
  const text =
    state === "expired"
      ? `Expired ${Math.abs(d)}d ago`
      : state === "expiring"
      ? `${d}d left`
      : `${d}d left`;
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-0 font-semibold",
        state === "active" && "bg-success/15 text-success",
        state === "expiring" && "bg-warning/20 text-warning",
        state === "expired" && "bg-destructive/20 text-destructive",
      )}
    >
      {text}
    </Badge>
  );
}