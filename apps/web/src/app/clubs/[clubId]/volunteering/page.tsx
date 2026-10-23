"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import { useClubId } from "../../club-route";
import { ClubWorkspace } from "@/components/clubs/club-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/lib/auth";
import { uploadFileToConvex } from "@/lib/convex-upload";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function hoursLabel(minutes: number) {
  return `${(minutes / 60).toFixed(2).replace(/\.00$/, "")} hr`;
}

function statusLabel(status: "PENDING" | "APPROVED" | "DECLINED") {
  return status === "PENDING" ? "Pending review" : status === "APPROVED" ? "Approved" : "Declined";
}

function proofPath(logId: string) {
  return `/api/clubs/volunteer-proof/${logId}`;
}

export default function VolunteeringPage() {
  const clubId = useClubId();
  const user = useCurrentUser();
  const { toast } = useToast();
  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, { clubId });
  const enabled = navigation?.club.volunteerTrackingEnabled ?? false;
  const isMember = navigation?.viewer.isMember ?? false;
  const canReview = navigation?.viewer.canReviewVolunteerHours ?? false;
  const summary = useQuery(api.clubs.volunteering.getMySummary, enabled && (isMember || canReview) ? { clubId } : "skip");
  const mine = usePaginatedQuery(api.clubs.volunteering.listMine, enabled && isMember ? { clubId } : "skip", { initialNumItems: 20 });
  const pending = usePaginatedQuery(api.clubs.volunteering.listPending, enabled && canReview ? { clubId } : "skip", { initialNumItems: 20 });
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeProof = useAction(api.uploads.files.finalizeVolunteerProof);
  const submit = useMutation(api.clubs.volunteering.submit);
  const review = useMutation(api.clubs.volunteering.review);

  const [activity, setActivity] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<(typeof mine.results)[number] | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!proof) return;
    const url = URL.createObjectURL(proof);
    setProofPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setProofPreview(null);
    };
  }, [proof]);

  function selectProof(file: File) {
    if (!IMAGE_TYPES.has(file.type) || file.size < 1 || file.size > MAX_IMAGE_BYTES) {
      toast({ title: "Choose a PNG, JPEG, GIF, or WebP photo under 5 MB", variant: "destructive" });
      return;
    }
    setProof(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !proof) return;
    const numericHours = Number(hours);
    const minutes = Math.round(numericHours * 60);
    if (!Number.isFinite(numericHours) || numericHours <= 0 || numericHours > 24 || minutes < 1) {
      toast({ title: "Enter between 1 minute and 24 hours", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await uploadFileToConvex(
        { generateUploadUrl: () => generateUploadUrl({ purpose: "VOLUNTEER_PROOF" }) },
        proof,
      );
      const finalized = await finalizeProof(uploaded);
      await submit({ clubId, activity, serviceDate, minutes, notes, proofUploadId: finalized.proofUploadId });
      setActivity("");
      setServiceDate("");
      setHours("");
      setNotes("");
      setProof(null);
      toast({ title: "Hours submitted", description: "They will count after a club reviewer approves them." });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not submit hours", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(decision: "APPROVED" | "DECLINED") {
    if (!selected || reviewing) return;
    if (decision === "DECLINED" && !reviewNote.trim()) {
      toast({ title: "Add a reason before declining", variant: "destructive" });
      return;
    }
    setReviewing(true);
    try {
      await review({ clubId, logId: selected._id, decision, note: reviewNote });
      setSelected(null);
      setReviewNote("");
      toast({ title: decision === "APPROVED" ? "Hours approved" : "Submission declined" });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Could not review hours", variant: "destructive" });
    } finally {
      setReviewing(false);
    }
  }

  return (
    <ClubWorkspace title="Volunteering">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {navigation === undefined ? <p className="text-sm text-muted-foreground">Loading volunteer hours…</p> :
          !enabled ? <p className="text-sm text-muted-foreground">Volunteer hours are not enabled for this club.</p> : (
          isMember || canReview ? <>
            {isMember ? <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-border/70 pb-5">
              <div><p className="text-xs text-muted-foreground">Approved hours</p><p className="text-2xl font-semibold">{hoursLabel(summary?.approvedMinutes ?? 0)}</p></div>
              <div><p className="text-xs text-muted-foreground">Awaiting review</p><p className="text-2xl font-semibold">{hoursLabel(summary?.pendingMinutes ?? 0)}</p></div>
              <div><p className="text-xs text-muted-foreground">Approved entries</p><p className="text-2xl font-semibold">{summary?.approvedCount ?? 0}</p></div>
            </div> : null}

            {isMember ? <Card>
              <CardHeader><CardTitle>Log service hours</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">Activity
                    <Input required maxLength={120} minLength={3} value={activity} onChange={(event) => setActivity(event.target.value)} placeholder="What did you do?" />
                  </label>
                  <label className="grid gap-1.5 text-sm">Date of service
                    <Input required type="date" max={new Date().toISOString().slice(0, 10)} value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm">Hours
                    <Input required type="number" min="0.02" max="24" step="0.01" inputMode="decimal" value={hours} onChange={(event) => setHours(event.target.value)} placeholder="e.g. 2.5" />
                  </label>
                  <div className="grid gap-1.5 text-sm">
                    <span>Proof photo (required)</span>
                    <FileInput accept="image/png,image/jpeg,image/webp,image/gif" label={proof ? "Change photo" : "Choose photo"} onFileSelect={selectProof} disabled={submitting} />
                    {proof ? <span className="break-all text-xs text-muted-foreground">{proof.name}</span> : null}
                  </div>
                  {proofPreview ? <Image unoptimized src={proofPreview} alt="Selected proof preview" width={640} height={400} className="max-h-48 max-w-full rounded-lg object-contain sm:col-span-2" /> : null}
                  <label className="grid gap-1.5 text-sm sm:col-span-2">Notes (optional)
                    <Textarea maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Location or details that help a reviewer" />
                  </label>
                  <div className="sm:col-span-2"><Button type="submit" disabled={!proof} loading={submitting}>Submit for review</Button></div>
                </form>
              </CardContent>
            </Card> : null}

            {isMember ? <section className="space-y-3">
              <h2 className="text-base font-semibold">My submissions</h2>
              {mine.results.length === 0 ? <p className="text-sm text-muted-foreground">No hours submitted yet.</p> : (
                <div className="overflow-x-auto">
                  <Table><TableHeader><TableRow><TableHead>Activity</TableHead><TableHead>Date</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead><TableHead>Proof</TableHead></TableRow></TableHeader>
                    <TableBody>{mine.results.map((log, index) => <TableRow key={log._id} index={index}>
                      <TableCell className="min-w-40">{log.activity}{log.reviewerNote ? <p className="text-xs text-muted-foreground">{log.reviewerNote}</p> : null}</TableCell>
                      <TableCell className="whitespace-nowrap">{log.serviceDate}</TableCell>
                      <TableCell className="whitespace-nowrap">{hoursLabel(log.minutes)}</TableCell>
                      <TableCell>{statusLabel(log.status)}</TableCell>
                      <TableCell>{log.proofAvailable ? <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(log)}>View</Button> : "Unavailable"}</TableCell>
                    </TableRow>)}</TableBody></Table>
                </div>
              )}
              {mine.status === "CanLoadMore" ? <Button type="button" variant="tertiary" onClick={() => mine.loadMore(20)}>Load more</Button> : null}
            </section> : null}

            {canReview ? <section className="space-y-3 border-t border-border/70 pt-6">
              <h2 className="text-base font-semibold">Needs review</h2>
              {pending.results.length === 0 ? <p className="text-sm text-muted-foreground">No submissions need review.</p> : (
                <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Activity</TableHead><TableHead>Date</TableHead><TableHead>Hours</TableHead><TableHead>Review</TableHead></TableRow></TableHeader>
                  <TableBody>{pending.results.map((log, index) => <TableRow key={log._id} index={index}>
                    <TableCell className="min-w-32">{log.studentName}</TableCell><TableCell className="min-w-40">{log.activity}</TableCell>
                    <TableCell className="whitespace-nowrap">{log.serviceDate}</TableCell><TableCell>{hoursLabel(log.minutes)}</TableCell>
                    <TableCell><Button type="button" size="sm" variant="ghost" onClick={() => setSelected(log)}>{log.userId === user?._id ? "View" : "Review"}</Button></TableCell>
                  </TableRow>)}</TableBody></Table></div>
              )}
              {pending.status === "CanLoadMore" ? <Button type="button" variant="tertiary" onClick={() => pending.loadMore(20)}>Load more</Button> : null}
            </section> : null}
          </> : <p className="text-sm text-muted-foreground">Join this club to log volunteer hours.</p>
        )}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) { setSelected(null); setReviewNote(""); } }}>
        <DialogContent size="lg">
          <DialogHeader><DialogTitle>{selected?.activity ?? "Proof photo"}</DialogTitle><DialogDescription>
            {selected ? `${selected.studentName} · ${selected.serviceDate} · ${hoursLabel(selected.minutes)}` : ""}
          </DialogDescription></DialogHeader>
          {selected?.notes ? <p className="text-sm">{selected.notes}</p> : null}
          {selected?.proofAvailable ? <Image unoptimized src={proofPath(selected._id)} alt={`Proof for ${selected.activity}`} width={800} height={600} className="max-h-[50vh] w-full rounded-lg object-contain" /> : <p className="text-sm text-muted-foreground">Proof photo unavailable.</p>}
          {selected?.status === "PENDING" && canReview && selected.userId !== user?._id ? <div className="space-y-3">
            <label className="grid gap-1.5 text-sm">Review note (required to decline)
              <Textarea maxLength={500} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="tertiary" loading={reviewing} onClick={() => void handleReview("DECLINED")}>Decline</Button>
              <Button type="button" loading={reviewing} onClick={() => void handleReview("APPROVED")}>Approve hours</Button>
            </div>
          </div> : null}
        </DialogContent>
      </Dialog>
    </ClubWorkspace>
  );
}
