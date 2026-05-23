import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { computeExpiry, fmtDate, generateMemberCode, PLAN_OPTIONS } from "@/lib/gym-utils";
import { supabase } from "@/integrations/supabase/client";
import { getMemberPhotoSignedUrl } from "@/lib/photo";
import { toast } from "sonner";
import { Loader2, Upload, User } from "lucide-react";
import { z } from "zod";

const Schema = z.object({
  member_code: z.string().min(1).max(40),
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(20),
  address: z.string().max(200).optional().or(z.literal("")),
  age: z.coerce.number().min(8).max(100).optional().nullable(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  joining_date: z.string().min(1),
  plan_months: z.coerce.number().int().min(1).max(60),
  plan_price: z.coerce.number().min(0).max(1_000_000),
  plan_type: z.enum(["general", "cardio", "personal_training"]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type MemberFormValues = z.infer<typeof Schema>;

export interface MemberFormProps {
  initial?: Partial<MemberFormValues> & { id?: string; photo_url?: string | null };
  onSaved: (id: string) => void;
  submitLabel?: string;
}

export function MemberForm({ initial, onSaved, submitLabel = "Save member" }: MemberFormProps) {
  const [v, setV] = useState<MemberFormValues>({
    member_code: initial?.member_code ?? generateMemberCode(),
    full_name: initial?.full_name ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    age: initial?.age ?? null,
    gender: initial?.gender ?? null,
    joining_date: initial?.joining_date ?? new Date().toISOString().slice(0, 10),
    plan_months: initial?.plan_months ?? 1,
    plan_price: initial?.plan_price ?? 0,
    plan_type: initial?.plan_type ?? "general",
    notes: initial?.notes ?? "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    if (!initial?.photo_url) return;
    getMemberPhotoSignedUrl(initial.photo_url).then((u) => { if (active) setPhotoPreview(u); });
    return () => { active = false; };
  }, [initial?.photo_url]);

  useEffect(() => {
    if (!photoFile) return;
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const expiry = computeExpiry(v.joining_date, Number(v.plan_months) || 1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Schema.safeParse(v);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    try {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures.user?.id;
      if (!uid) throw new Error("Not authenticated");

      let photo_url: string | null = initial?.photo_url ?? null;
      if (photoFile) {
        const path = `${uid}/${Date.now()}-${photoFile.name.replace(/[^\w.\-]/g, "_")}`;
        const up = await supabase.storage.from("member-photos").upload(path, photoFile, {
          cacheControl: "3600", upsert: false,
        });
        if (up.error) throw up.error;
        photo_url = path;
      }

      const payload = {
        ...parsed.data,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
        expiry_date: expiry.toISOString().slice(0, 10),
        owner_id: uid,
        photo_url,
      };
      // plan_type is captured in notes prefix to avoid schema changes
      payload.notes = `[${parsed.data.plan_type}]${payload.notes ? " " + payload.notes : ""}`;

      if (initial?.id) {
        const { error } = await supabase.from("members").update(payload).eq("id", initial.id);
        if (error) throw error;
        toast.success("Member updated");
        onSaved(initial.id);
      } else {
        const { data, error } = await supabase.from("members").insert(payload).select("id").single();
        if (error) throw error;
        if (Number(parsed.data.plan_price) > 0) {
          await supabase.from("payments").insert({
            member_id: data.id, owner_id: uid,
            amount: parsed.data.plan_price, method: "cash", status: "paid",
          });
        }
        toast.success("Member added");
        onSaved(data.id);
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : "Save failed";
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof MemberFormValues>(k: K, val: MemberFormValues[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1 space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl bg-muted">
            {photoPreview ? (
              <img src={photoPreview} alt="Member" className="h-full w-full object-cover" />
            ) : (
              <User className="h-16 w-16 text-muted-foreground" />
            )}
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:bg-accent">
            <Upload className="h-4 w-4" />
            <span>Upload photo</span>
            <input
              type="file" accept="image/*" className="hidden"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Member ID</span><span className="font-mono">{v.member_code}</span></div>
            <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Expires on</span><span className="font-semibold text-primary">{fmtDate(expiry)}</span></div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
        <Row label="Full name" required>
          <Input value={v.full_name} onChange={(e) => set("full_name", e.target.value)} maxLength={80} required />
        </Row>
        <Row label="Phone" required>
          <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} maxLength={20} required />
        </Row>
        <Row label="Age">
          <Input type="number" min={8} max={100} value={v.age ?? ""} onChange={(e) => set("age", e.target.value === "" ? null : Number(e.target.value))} />
        </Row>
        <Row label="Gender">
          <Select value={v.gender ?? ""} onValueChange={(val) => set("gender", val as MemberFormValues["gender"])}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Joining date" required>
          <Input type="date" value={v.joining_date} onChange={(e) => set("joining_date", e.target.value)} required />
        </Row>
        <Row label="Plan duration" required>
          <Select value={String(v.plan_months)} onValueChange={(val) => set("plan_months", Number(val))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLAN_OPTIONS.map((p) => (
                <SelectItem key={p.months} value={String(p.months)}>{p.label}</SelectItem>
              ))}
              <SelectItem value="2">2 Months</SelectItem>
              <SelectItem value="24">2 Years</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Plan price">
          <Input type="number" min={0} step="1" value={v.plan_price} onChange={(e) => set("plan_price", Number(e.target.value))} />
        </Row>
        <Row label="Fee type" required>
          <Select value={v.plan_type} onValueChange={(val) => set("plan_type", val as MemberFormValues["plan_type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General Fee</SelectItem>
              <SelectItem value="cardio">Cardio Fee</SelectItem>
              <SelectItem value="personal_training">Personal Training</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Member code" required>
          <Input value={v.member_code} onChange={(e) => set("member_code", e.target.value)} maxLength={40} required />
        </Row>
        <Row label="Address" full>
          <Textarea rows={2} value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} maxLength={200} />
        </Row>
        <Row label="Notes" full>
          <Textarea rows={2} value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
        </Row>

        <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={busy} className="min-w-[160px]">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Row({
  label, required, full, children,
}: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={"space-y-1.5 " + (full ? "sm:col-span-2" : "")}>
      <Label>
        {label} {required && <span className="text-primary">*</span>}
      </Label>
      {children}
    </div>
  );
}