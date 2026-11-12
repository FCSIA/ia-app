"use client";

import { useState } from "react";
import { api } from "~/apps/convex/src/_generated/api";
import { GRADE_LEVELS, PATHWAY_OPTIONS, isPathway } from "~/apps/shared/labels";
import { useMutation } from "@/lib/convex-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { ClubDetail } from "./types";

const ANY = "ANY";

function RuleField({ id, label, value, onChange, options }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} />
        <SelectContent>
          <SelectGroup>
            <SelectItem index={0} value={ANY}>Any</SelectItem>
            {options.map((option, index) => (
              <SelectItem key={option.value} index={index + 1} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

const gradeOptions = GRADE_LEVELS.map((grade) => ({ value: String(grade), label: `Grade ${grade}` }));

export function ClubJoinRulesSettings({ club }: { club: ClubDetail }) {
  const [grade, setGrade] = useState(String(club.joinRules?.gradeLevel ?? ANY));
  const [major, setMajor] = useState<string>(club.joinRules?.major ?? ANY);
  const [minor, setMinor] = useState<string>(club.joinRules?.minor ?? ANY);
  const [saving, setSaving] = useState(false);
  const update = useMutation(api.clubs.management.update);
  const { toast } = useToast();

  const changed = grade !== String(club.joinRules?.gradeLevel ?? ANY) ||
    major !== (club.joinRules?.major ?? ANY) || minor !== (club.joinRules?.minor ?? ANY);

  async function save() {
    const gradeLevel = GRADE_LEVELS.find((value) => String(value) === grade);
    const joinRules = {
      ...(gradeLevel !== undefined ? { gradeLevel } : {}),
      ...(isPathway(major) ? { major } : {}),
      ...(isPathway(minor) ? { minor } : {}),
    };
    setSaving(true);
    try {
      await update({ clubId: club._id, joinRules: Object.keys(joinRules).length ? joinRules : null });
      toast({ title: "Join rules saved" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not save join rules", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="pb-0">
      <CardHeader className="px-5 pt-4">
        <h2><CardTitle>Join rules</CardTitle></h2>
        <p className="text-sm text-muted-foreground">
          New members must meet every requirement you set. Current members keep their memberships.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 px-5 pb-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <RuleField id="club-join-grade" label="Grade" value={grade} onChange={setGrade} options={gradeOptions} />
          <RuleField id="club-join-major" label="Major pathway" value={major} onChange={setMajor} options={PATHWAY_OPTIONS} />
          <RuleField id="club-join-minor" label="Minor pathway" value={minor} onChange={setMinor} options={PATHWAY_OPTIONS} />
        </div>
        <Button type="button" size="sm" disabled={!changed || saving} loading={saving} onClick={() => void save()}>
          Save join rules
        </Button>
      </CardContent>
    </Card>
  );
}
