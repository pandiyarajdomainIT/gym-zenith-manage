import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberForm } from "@/components/member-form";
import { ExpiryBadge } from "@/components/expiry-badge";
import { fmtDate, currency } from "@/lib/gym-utils";
import { toast } from "sonner";
import { ArrowLeft, CalendarCheck, User, Phone, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/members/$id")({
  component: MemberDetail,
});

function MemberDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const member = useQuery({
    queryKey: ["member", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const attendance = useQuery({
    queryKey: ["attendance", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("*").eq("member_id", id).order("checked_in_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const payments = useQuery({
    queryKey: ["payments", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("member_id", id).order("paid_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (member.isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!member.data) return <div className="text-muted-foreground">Not found</div>;

  const m = member.data;

  const checkIn = async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("attendance").insert({ member_id: id, owner_id: u.user!.id });
    if (error) return toast.error(error.message);
    toast.success("Checked in");
    qc.invalidateQueries({ queryKey: ["attendance", id] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link to="/members"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        <ExpiryBadge expiryDate={m.expiry_date} />
      </div>

      <Card className="border-border/60 bg-[var(--gradient-card)]">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
            {m.photo_url ? <img src={m.photo_url} alt={m.full_name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><User className="h-10 w-10 text-muted-foreground" /></div>}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black tracking-tight">{m.full_name}</h1>
            <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">{m.member_code}</div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4" />{m.phone}</span>
              {m.address && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{m.address}</span>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Mini label="Plan" value={`${m.plan_months}m`} />
            <Mini label="Fee" value={currency(m.plan_price)} />
            <Mini label="Expires" value={fmtDate(m.expiry_date)} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <Row k="Joining" v={fmtDate(m.joining_date)} />
              <Row k="Age" v={m.age ?? "—"} />
              <Row k="Gender" v={m.gender ?? "—"} />
              <Row k="Status" v={m.status} />
              <Row k="Notes" v={m.notes ?? "—"} />
            </CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Quick actions</CardTitle>
              <Button size="sm" onClick={checkIn}><CalendarCheck className="mr-2 h-4 w-4" />Check in</Button>
            </CardHeader><CardContent className="text-sm text-muted-foreground">
              <p>{attendance.data?.length ?? 0} recent check-ins. {payments.data?.length ?? 0} payment records.</p>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="edit">
          <Card><CardContent className="p-6">
            <MemberForm
              initial={{
                id: m.id, member_code: m.member_code, full_name: m.full_name, phone: m.phone,
                address: m.address ?? "", age: m.age ?? null, gender: m.gender,
                joining_date: m.joining_date, plan_months: m.plan_months, plan_price: Number(m.plan_price),
                notes: m.notes ?? "", photo_url: m.photo_url,
              }}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["member", id] });
                qc.invalidateQueries({ queryKey: ["members"] });
                navigate({ to: "/members/$id", params: { id } });
              }}
              submitLabel="Update member"
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card><CardContent className="p-6">
            <Button onClick={checkIn} className="mb-4"><CalendarCheck className="mr-2 h-4 w-4" />Check in now</Button>
            {attendance.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {attendance.data?.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>{new Date(a.checked_in_at).toLocaleString()}</span>
                    <span className="text-muted-foreground">{a.notes ?? ""}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card><CardContent className="p-6">
            <AddPayment memberId={id} onAdded={() => qc.invalidateQueries({ queryKey: ["payments", id] })} />
            <div className="mt-4 divide-y divide-border">
              {payments.data?.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
              {payments.data?.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-semibold">{currency(p.amount)}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(p.paid_on)} · {p.method}</div>
                  </div>
                  <span className={
                    p.status === "paid" ? "rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success" :
                    p.status === "pending" ? "rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning" :
                    "rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive"
                  }>{p.status}</span>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-lg bg-muted/40 px-3 py-2"><div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div><div className="text-sm font-semibold">{value}</div></div>;
}

function AddPayment({ memberId, onAdded }: { memberId: string; onAdded: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash"|"card"|"upi"|"bank"|"other">("cash");
  const [status, setStatus] = useState<"paid"|"pending"|"overdue">("paid");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!amount) return toast.error("Enter amount");
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      member_id: memberId, owner_id: u.user!.id, amount: Number(amount), method, status,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Payment added");
    setAmount("");
    onAdded();
  };
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1 min-w-[120px]"><label className="text-xs text-muted-foreground">Amount</label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div><label className="text-xs text-muted-foreground">Method</label>
        <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["cash","card","upi","bank","other"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><label className="text-xs text-muted-foreground">Status</label>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["paid","pending","overdue"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={submit} disabled={busy}><Plus className="mr-1 h-4 w-4" />Add</Button>
    </div>
  );
}