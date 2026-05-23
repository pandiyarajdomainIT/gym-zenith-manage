import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { Search, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
  head: () => ({ meta: [{ title: "Attendance — IronCore" }] }),
});

function AttendancePage() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["attendance-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("id, checked_in_at, notes, member_id, members:members(id, full_name, phone, member_code, photo_url)")
        .order("checked_in_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return (data ?? []).filter((r) => new Date(r.checked_in_at).toDateString() === today).length;
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">{todayCount} check-ins today · {data?.length ?? 0} recent</p>
        </div>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search member" className="pl-9" />
        </div>
      </div>

      <Card><CardHeader><CardTitle>Recent check-ins</CardTitle></CardHeader><CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-ins. Open a member and click Check in.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((r) => {
              const m = r.members as unknown as { id: string; full_name: string; phone: string; member_code: string; photo_url: string | null } | null;
              if (!m) return null;
              return (
                <Link key={r.id} to="/members/$id" params={{ id: m.id }} className="flex items-center gap-3 py-3 hover:bg-accent/30 -mx-2 px-2 rounded-md">
                  <div className="h-10 w-10 overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                    <MemberPhoto photoUrl={m.photo_url} className="h-full w-full object-cover" fallbackIconClassName="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{m.full_name}</div>
                    <div className="text-xs text-muted-foreground">{m.phone} · {m.member_code}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">{new Date(r.checked_in_at).toLocaleString()}</div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}