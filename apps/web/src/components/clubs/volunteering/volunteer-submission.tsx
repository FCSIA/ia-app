"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { useAction, useMutation } from "@/lib/convex-react";
import { uploadFileToConvex } from "@/lib/convex-upload";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VolunteerProof } from "./volunteer-ui";

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export function VolunteerSubmission({ clubId }: { clubId: Id<"clubs"> }) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState("");
  const [date, setDate] = useState("");
  const [today, setToday] = useState<Date>();
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Keep a finalized stage on submission failure so a correction doesn't upload
  // and charge quota again. Replacing the selected photo invalidates this stage.
  const staged = useRef<{
    file: File;
    proofUploadId: Id<"volunteerProofUploads">;
  } | null>(null);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalize = useAction(api.uploads.files.finalizeVolunteerProof);
  const submit = useMutation(api.clubs.volunteering.submit);
  const { toast } = useToast();

  useEffect(() => {
    if (!proof) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(proof);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [proof]);

  function selectProof(file: File) {
    if (
      !IMAGE_TYPES.has(file.type) ||
      !file.size ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPEG, GIF, or WebP photo of 5 MB or less.");
      return;
    }
    staged.current = null;
    setProof(file);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const h = Number(hours || 0);
    const m = Number(minutes || 0);
    const total = h * 60 + m;
    if (!date || !proof) {
      setError("Choose a service date and a proof photo.");
      return;
    }
    if (
      !Number.isInteger(h) ||
      !Number.isInteger(m) ||
      h < 0 ||
      m < 0 ||
      m > 59 ||
      total < 1 ||
      total > 1440
    ) {
      setError(
        "Enter between 1 minute and 24 hours, using whole hours and minutes.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      let stage = staged.current;
      if (!stage || stage.file !== proof) {
        const uploaded = await uploadFileToConvex(
          {
            generateUploadUrl: () =>
              generateUploadUrl({ purpose: "VOLUNTEER_PROOF" }),
          },
          proof,
        );
        stage = { file: proof, ...(await finalize(uploaded)) };
        staged.current = stage;
      }
      await submit({
        clubId,
        activity: activity.trim(),
        serviceDate: date,
        minutes: total,
        notes: notes.trim(),
        proofUploadId: stage.proofUploadId,
      });
      staged.current = null;
      setOpen(false);
      setActivity("");
      setDate("");
      setHours("");
      setMinutes("");
      setNotes("");
      setProof(null);
      toast({
        title: "Hours submitted",
        description: "Your approved total updates after review.",
      });
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not submit hours. Please try again.";
      if (/Proof image not found|already been submitted/.test(message))
        staged.current = null;
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          if (value) setToday(new Date());
          setOpen(value);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button leadingIcon={Plus}>Log hours</Button>
      </DialogTrigger>
      <DialogContent
        size="lg"
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Log service hours</DialogTitle>
          <DialogDescription>
            Submit your time and a proof photo for club review.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void save(event)}>
          <FieldGroup>
            <Field data-disabled={busy}>
              <FieldLabel htmlFor="volunteer-activity">Activity</FieldLabel>
              <Input
                id="volunteer-activity"
                required
                minLength={3}
                maxLength={120}
                value={activity}
                disabled={busy}
                onChange={(event) => setActivity(event.target.value)}
                placeholder="What did you do?"
              />
            </Field>
            <Field data-disabled={busy}>
              <FieldTitle id="volunteer-date-label">Date of service</FieldTitle>
              <div role="group" aria-labelledby="volunteer-date-label">
                <DatePicker
                  value={date}
                  onChange={setDate}
                  placeholder="Choose service date"
                  disabled={busy}
                  disabledDays={today ? { after: today } : undefined}
                />
              </div>
            </Field>
            <FieldGroup className="grid grid-cols-2 gap-4">
              <Field data-disabled={busy}>
                <FieldLabel htmlFor="volunteer-hours">Hours</FieldLabel>
                <Input
                  id="volunteer-hours"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={24}
                  step={1}
                  placeholder="0"
                  value={hours}
                  disabled={busy}
                  onChange={(event) => setHours(event.target.value)}
                />
              </Field>
              <Field data-disabled={busy}>
                <FieldLabel htmlFor="volunteer-minutes">Minutes</FieldLabel>
                <Input
                  id="volunteer-minutes"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  step={1}
                  placeholder="0"
                  value={minutes}
                  disabled={busy}
                  onChange={(event) => setMinutes(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <Field data-disabled={busy}>
              <FieldTitle>Proof photo</FieldTitle>
              <div className="flex flex-wrap items-center gap-3">
                <FileInput
                  id="volunteer-proof"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  buttonSize="md"
                  label={proof ? "Change photo" : "Choose photo"}
                  disabled={busy}
                  onFileSelect={selectProof}
                />
                {proof ? (
                  <span className="min-w-0 break-all text-sm text-muted-foreground">
                    {proof.name}
                  </span>
                ) : null}
              </div>
              <FieldDescription>
                Required · PNG, JPEG, GIF or WebP · Up to 5 MB
              </FieldDescription>
              {preview ? (
                <VolunteerProof
                  key={preview}
                  src={preview}
                  alt="Selected proof preview"
                />
              ) : null}
            </Field>
            <Field data-disabled={busy}>
              <FieldLabel htmlFor="volunteer-notes">
                Notes (optional)
              </FieldLabel>
              <Textarea
                id="volunteer-notes"
                rows={3}
                maxLength={1000}
                value={notes}
                disabled={busy}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Details that help a reviewer"
              />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="tertiary"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Submit for review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
