import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line,
} from "recharts";
import { currency } from "@/lib/gym-utils";
import { format, startOfMonth, subMonths, startOfYear, addMonths } from "date-fns";
import { exportMembersExcel, exportMembersPdf } from "@/lib/exporters";
import { FileDown, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Reports — IronCore" }] }),
});

function ReportsPage() {
  const members = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("members").select("*")).data ?? [],
  });
  const payments = useQuery({
    queryKey: ["payments-all-r"],
    queryFn: async () => (await supabase.from("payments").select("*")).data ?? [],
  });

  const list = members.data ?? [];
  const pays = payments.data ?? [];

  const now = new Date();
  const yearStart = startOfYear(now);

  const monthly = Array.from({ length: 12 }).map((_, i) => {
    const from = addMonths(yearStart, i);
    const to = addMonths(from, 1);
    const label = format(from, "MMM");
    const joined = list.filter((m) => { const c = new Date(m.created_at); return c >= from && c < to; }).length;
    const revenue = pays
      .filter((p) => { const d = new Date(p.paid_on); return p.status === "paid" && d >= from && d < to; })
      .reduce((a, p) => a + Number(p.amount), 0);
    return { month: label, joined, revenue };
  });

  const yearly = (() => {
    const map = new Map<number, { joined: number; revenue: number }>();
    list.forEach((m) => {
      const y = new Date(m.created_at).getFullYear();
      const v = map.get(y) ?? { joined: 0, revenue: 0 };
      v.joined += 1; map.set(y, v);
    });
    pays.filter((p) => p.status === "paid").forEach((p) => {
      const y = new Date(p.paid_on).getFullYear();
      const v = map.get(y) ?? { joined: 0, revenue: 0 };
      v.revenue += Number(p.amount); map.set(y, v);
    });
    return Array.from(map.entries()).sort(([a],[b]) => a - b).map(([year, v]) => ({ year: String(year), ...v }));
  })();

  const totalRevenue = pays.filter((p) => p.status === "paid").reduce((a, p) => a + Number(p.amount), 0);
  const last30 = subMonths(now, 1);
  const recent = list.filter((m) => new Date(m.created_at) >= last30).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Lifetime revenue {currency(totalRevenue)} · {list.length} members · {recent} new (30d)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportMembersExcel(list)}><FileDown className="mr-2 h-4 w-4" />Members Excel</Button>
          <Button variant="outline" onClick={() => exportMembersPdf(list)}><FileText className="mr-2 h-4 w-4" />Members PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Monthly revenue · {now.getFullYear()}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Monthly new members · {now.getFullYear()}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="joined" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Yearly summary</CardTitle></CardHeader><CardContent>
        {yearly.length === 0 ? <p className="text-sm text-muted-foreground">No data yet.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2">Year</th><th>New members</th><th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((y) => (
                <tr key={y.year} className="border-b border-border/50">
                  <td className="py-3 font-semibold">{y.year}</td>
                  <td>{y.joined}</td>
                  <td className="text-right font-semibold">{currency(y.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent></Card>
    </div>
  );
}