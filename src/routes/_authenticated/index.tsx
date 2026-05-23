import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, AlertTriangle, IndianRupee, TrendingUp, UserPlus, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import { currency, daysUntil, fmtDate } from "@/lib/gym-utils";
import { ExpiryBadge } from "@/components/expiry-badge";
import { format, startOfMonth, subMonths } from "date-fns";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Endurance" }] }),
});

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

function Dashboard() {
  const members = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const payments = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").order("paid_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const list = members.data ?? [];
  const pays = payments.data ?? [];

  const now = new Date();
  const monthStart = startOfMonth(now);

  const total = list.length;
  const active = list.filter((m) => new Date(m.expiry_date) >= now).length;
  const expiring = list.filter((m) => {
    const d = daysUntil(m.expiry_date);
    return d >= 0 && d <= 7;
  });
  const expired = list.filter((m) => new Date(m.expiry_date) < now);
  const newThisMonth = list.filter((m) => new Date(m.created_at) >= monthStart).length;

  const monthlyRevenue = pays
    .filter((p) => p.status === "paid" && new Date(p.paid_on) >= monthStart)
    .reduce((a, p) => a + Number(p.amount), 0);
  const yearlyRevenue = pays
    .filter((p) => p.status === "paid" && new Date(p.paid_on).getFullYear() === now.getFullYear())
    .reduce((a, p) => a + Number(p.amount), 0);

  const last6 = Array.from({ length: 6 }).map((_, i) => {
    const d = subMonths(monthStart, 5 - i);
    const label = format(d, "MMM");
    const next = subMonths(monthStart, 5 - i - 1);
    const joined = list.filter((m) => {
      const c = new Date(m.created_at);
      return c >= d && c < next;
    }).length;
    const revenue = pays
      .filter((p) => {
        const dt = new Date(p.paid_on);
        return p.status === "paid" && dt >= d && dt < next;
      })
      .reduce((a, p) => a + Number(p.amount), 0);
    return { month: label, joined, revenue };
  });

  const planMix = (() => {
    const m = new Map<string, number>();
    list.forEach((x) => {
      const k = `${x.plan_months}m`;
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value }));
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time pulse of your gym</p>
        </div>
        <Button asChild>
          <Link to="/members/new"><UserPlus className="mr-2 h-4 w-4" /> Add Member</Link>
        </Button>
      </div>

      {expiring.length + expired.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
          <div className="flex-1">
            <div className="font-semibold text-warning">
              {expiring.length} expiring soon · {expired.length} already expired
            </div>
            <p className="text-sm text-muted-foreground">
              Send reminders or renew their plans from the Members page.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/members">View<ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Total members" value={total} sub={`${active} active`} />
        <Stat icon={UserPlus} label="New this month" value={newThisMonth} sub="Joined" />
        <Stat icon={IndianRupee} label="Revenue (month)" value={currency(monthlyRevenue)} sub="Paid invoices" />
        <Stat icon={TrendingUp} label="Revenue (year)" value={currency(yearlyRevenue)} sub={String(now.getFullYear())} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader><CardTitle>Revenue · last 6 months</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last6}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader><CardTitle>Plan mix</CardTitle></CardHeader>
          <CardContent className="h-72">
            {planMix.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={planMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {planMix.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader><CardTitle>New joinings · last 6 months</CardTitle></CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last6}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="joined" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader><CardTitle>Expiring soon</CardTitle></CardHeader>
        <CardContent>
          {expiring.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans expiring in the next 7 days.</p>
          ) : (
            <div className="divide-y divide-border">
              {expiring.map((m) => (
                <Link
                  key={m.id} to="/members/$id" params={{ id: m.id }}
                  className="flex items-center justify-between gap-3 py-3 hover:bg-accent/30 -mx-2 px-2 rounded-md transition"
                >
                  <div>
                    <div className="font-semibold">{m.full_name}</div>
                    <div className="text-xs text-muted-foreground">{m.phone} · {m.member_code}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{fmtDate(m.expiry_date)}</span>
                    <ExpiryBadge expiryDate={m.expiry_date} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon, label, value, sub,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="relative overflow-hidden border-border/60 bg-[var(--gradient-card)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 text-3xl font-black tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet</div>;
}