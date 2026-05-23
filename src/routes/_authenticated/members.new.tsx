import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MemberForm } from "@/components/member-form";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/members/new")({
  component: NewMember,
  head: () => ({ meta: [{ title: "Add Member — Endurance" }] }),
});

function NewMember() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Add Member</h1>
        <p className="text-sm text-muted-foreground">Register a new gym member</p>
      </div>
      <Card className="border-border/60"><CardContent className="p-6">
        <MemberForm
          onSaved={(id) => {
            qc.invalidateQueries({ queryKey: ["members"] });
            navigate({ to: "/members/$id", params: { id } });
          }}
        />
      </CardContent></Card>
    </div>
  );
}