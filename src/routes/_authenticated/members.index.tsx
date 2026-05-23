import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { Search, UserPlus, Trash2, FileDown, FileText, User } from "lucide-react";
import { ExpiryBadge } from "@/components/expiry-badge";
import { fmtDate, currency } from "@/lib/gym-utils";
import { toast } from "sonner";
import { exportMembersExcel, exportMembersPdf } from "@/lib/exporters";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/members/")({
  component: MembersPage,
  head: () => ({ meta: [{ title: "Members — IronCore" }] }),
});

function MembersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((m) =>
      m.full_name.toLowerCase().includes(s) ||
      m.phone.toLowerCase().includes(s) ||
      m.member_code.toLowerCase().includes(s),
    );
  }, [data, q]);

  const onDelete = async (id: string) => {
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Member deleted");
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {data?.length ?? 0} total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportMembersExcel(filtered)}>
            <FileDown className="mr-2 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" onClick={() => exportMembersPdf(filtered)}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button asChild>
            <Link to="/members/new"><UserPlus className="mr-2 h-4 w-4" /> Add Member</Link>
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, or ID" className="pl-9" />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">
          No members. <Link to="/members/new" className="text-primary underline">Add the first one</Link>.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <Card key={m.id} className="group overflow-hidden border-border/60 transition hover:border-primary/60 hover:shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                    {m.photo_url ? (
                      <img src={m.photo_url} alt={m.full_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><User className="h-6 w-6 text-muted-foreground" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to="/members/$id" params={{ id: m.id }} className="block truncate font-semibold hover:text-primary">
                      {m.full_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{m.phone}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.member_code}</div>
                  </div>
                  <ExpiryBadge expiryDate={m.expiry_date} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-center text-[11px]">
                  <div><div className="text-muted-foreground">Plan</div><div className="font-semibold">{m.plan_months}m</div></div>
                  <div><div className="text-muted-foreground">Fee</div><div className="font-semibold">{currency(m.plan_price)}</div></div>
                  <div><div className="text-muted-foreground">Expires</div><div className="font-semibold">{fmtDate(m.expiry_date)}</div></div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button asChild variant="outline" size="sm"><Link to="/members/$id" params={{ id: m.id }}>Open</Link></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {m.full_name}?</AlertDialogTitle>
                        <AlertDialogDescription>This also removes attendance and payment history. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(m.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}