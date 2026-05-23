import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currency, fmtDate } from "@/lib/gym-utils";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Payments — Endurance" }] }),
});

function PaymentsPage() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["payments-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, paid_on, method, status, member_id, members:members(id, full_name, phone, member_code)")
        .order("paid_on", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => {
    const t = { paid: 0, pending: 0, overdue: 0 };
    (data ?? []).forEach((p) => { t[p.status as keyof typeof t] += Number(p.amount); });
    return t;
  }, [data]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((r) => {
      const m = r.members as unknown as { full_name: string; phone: string; member_code: string } | null;
      if (!m) return false;
      return m.full_name.toLowerCase().includes(s) || m.phone.includes(s) || m.member_code.toLowerCase().includes(s);
    });
  }, [data, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">Track collections and dues</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tot label="Collected" value={currency(totals.paid)} tone="success" />
        <Tot label="Pending" value={currency(totals.pending)} tone="warning" />
        <Tot label="Overdue" value={currency(totals.overdue)} tone="destructive" />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search member" className="pl-9" />
      </div>

      <Card><CardHeader><CardTitle>All payments</CardTitle></CardHeader><CardContent>
        {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
          <div className="divide-y divide-border">
            {filtered.map((p) => {
              const m = p.members as unknown as { id: string; full_name: string; phone: string; member_code: string } | null;
              return (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    {m ? (
                      <Link to="/members/$id" params={{ id: m.id }} className="font-semibold hover:text-primary">{m.full_name}</Link>
                    ) : <span className="font-semibold">—</span>}
                    <div className="text-xs text-muted-foreground">{fmtDate(p.paid_on)} · {p.method}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{currency(p.amount)}</div>
                    <span className={
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase " +
                      (p.status === "paid" ? "bg-success/15 text-success" :
                       p.status === "pending" ? "bg-warning/15 text-warning" :
                       "bg-destructive/15 text-destructive")
                    }>{p.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}

function Tot({ label, value, tone }: { label: string; value: string; tone: "success"|"warning"|"destructive" }) {
  const cls =
    tone === "success" ? "border-success/30 text-success" :
    tone === "warning" ? "border-warning/30 text-warning" :
    "border-destructive/30 text-destructive";
  return (
    <Card className={`border ${cls}`}>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}