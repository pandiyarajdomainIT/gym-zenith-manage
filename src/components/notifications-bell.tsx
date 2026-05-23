import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { daysUntil, fmtDate } from "@/lib/gym-utils";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  full_name: string;
  member_code: string;
  phone: string;
  joining_date: string;
  expiry_date: string;
};

const NOTIFIED_KEY = "endurance.notified-expiry.v1";

export function NotificationsBell() {
  const { data } = useQuery({
    queryKey: ["members", "expiry-watch"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, member_code, phone, joining_date, expiry_date")
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data as Member[];
    },
    refetchInterval: 60_000,
  });

  const { expiring, expired } = useMemo(() => {
    const list = data ?? [];
    const expiring: Member[] = [];
    const expired: Member[] = [];
    for (const m of list) {
      const d = daysUntil(m.expiry_date);
      if (d < 0) expired.push(m);
      else if (d <= 7) expiring.push(m);
    }
    return { expiring, expired };
  }, [data]);

  const total = expiring.length + expired.length;
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  // Fire one browser notification per member per day.
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!data) return;
    const today = new Date().toISOString().slice(0, 10);
    let notified: Record<string, string> = {};
    try {
      notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "{}");
    } catch {}
    const toFire = [...expired, ...expiring].filter((m) => notified[m.id] !== today);
    toFire.slice(0, 5).forEach((m) => {
      const d = daysUntil(m.expiry_date);
      const status = d < 0 ? `expired ${Math.abs(d)}d ago` : `expires in ${d}d`;
      try {
        new Notification(`Membership ${d < 0 ? "expired" : "ending soon"}`, {
          body: `${m.full_name} (${m.member_code}) · ${m.phone}\nJoined ${fmtDate(
            m.joining_date,
          )} · ${status}. Renewal payment required.`,
          tag: `member-${m.id}-${today}`,
        });
        notified[m.id] = today;
      } catch {}
    });
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
  }, [data, expiring, expired]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          {total > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-bold">Membership alerts</div>
            <div className="text-xs text-muted-foreground">
              {expired.length} expired · {expiring.length} expiring soon
            </div>
          </div>
          {permission !== "granted" && (
            <Button size="sm" variant="outline" onClick={requestPermission}>
              Enable alerts
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {total === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              All memberships are healthy.
            </div>
          )}
          {[...expired, ...expiring].map((m) => {
            const d = daysUntil(m.expiry_date);
            const isExpired = d < 0;
            return (
              <Link
                key={m.id}
                to="/members/$id"
                params={{ id: m.id }}
                className={cn(
                  "block border-b border-border/60 px-4 py-3 transition hover:bg-accent/40",
                  isExpired && "bg-destructive/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{m.full_name}</span>
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">
                        {m.member_code}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {m.phone} · joined {fmtDate(m.joining_date)}
                    </div>
                    <div className="mt-1 text-xs">
                      <span
                        className={cn(
                          "font-medium",
                          isExpired ? "text-destructive" : "text-warning",
                        )}
                      >
                        {isExpired
                          ? `Expired ${Math.abs(d)}d ago`
                          : `Ending in ${d}d`}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        · ends {fmtDate(m.expiry_date)} · renewal required
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}