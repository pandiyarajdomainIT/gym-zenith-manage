import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addMonths } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { PLAN_OPTIONS, currency } from "@/lib/gym-utils";
import { toast } from "sonner";

type Props = {
  memberId: string;
  currentExpiry: string;
  currentPrice?: number;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
};

export function RenewButton({
  memberId,
  currentExpiry,
  currentPrice = 0,
  size = "sm",
  variant = "default",
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(String(currentPrice || 0));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      // Extend from later of today or current expiry
      const base = new Date(currentExpiry);
      const today = new Date();
      const from = base > today ? base : today;
      const newExpiry = addMonths(from, months).toISOString().slice(0, 10);

      const { data: u } = await supabase.auth.getUser();
      const ownerId = u.user!.id;

      const { error: e1 } = await supabase
        .from("members")
        .update({
          expiry_date: newExpiry,
          plan_months: months,
          plan_price: Number(amount) || 0,
          status: "active",
        })
        .eq("id", memberId);
      if (e1) throw e1;

      if (Number(amount) > 0) {
        const { error: e2 } = await supabase.from("payments").insert({
          member_id: memberId,
          owner_id: ownerId,
          amount: Number(amount),
          method: "cash",
          status: "paid",
          notes: `Renewal · ${months}m`,
        });
        if (e2) throw e2;
      }

      toast.success(`Renewed for ${months}m · new expiry ${newExpiry}`);
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["member", memberId] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["payments", memberId] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Renewal failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant} onClick={(e) => e.stopPropagation()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Renew
        </Button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Renew membership</DialogTitle>
          <DialogDescription>
            Extends the plan and records a payment. New expiry calculated from today
            or current expiry, whichever is later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label className="mb-1.5 block text-xs">Plan duration</Label>
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((p) => (
                  <SelectItem key={p.months} value={String(p.months)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">
              Payment amount ({currency(0).replace(/[\d.,\s]/g, "")})
            </Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0 to skip payment"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Renewing…" : "Confirm renewal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}