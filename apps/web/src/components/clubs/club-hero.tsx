"use client";

import { useEffect, useState } from "react";
import { Pencil, Settings2, Trash2 } from "lucide-react";
import { useAction, useMutation } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import type { ClubDetail } from "@/components/clubs/types";
import { Button } from "@/components/ui/button";
import { EditableAvatar } from "@/components/ui/editable-avatar";
import { ImageCropDialog } from "@/components/ui/image-crop-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ColorPickerPopover } from "@/components/ui/color-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileInput } from "@/components/ui/file-input";
import { Tooltip } from "@/components/ui/tooltip";
import { uploadFileToConvex } from "@/lib/convex-upload";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";

function resolveMediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  return url;
}

export function ClubHero({
  club,
  canEdit,
}: {
  club: ClubDetail;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const updateClub = useMutation(api.clubs.management.update);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeClubImage = useAction(api.uploads.files.finalizeClubImage);
  const clearClubImage = useMutation(api.uploads.files.clearClubImage);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    overview: club.overview ?? "",
    accentColor: club.accentColor ?? "",
    logoUrl: club.logoUrl ?? "",
    bannerUrl: club.bannerUrl ?? "",
    memberLimit: club.memberLimit?.toString() ?? "",
    joinPolicy: club.joinPolicy,
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [pendingCrop, setPendingCrop] = useState<{
    file: File;
    kind: "logo" | "banner";
    previewUrl: string;
  } | null>(null);

  useEffect(
    () => () => {
      if (pendingCrop) URL.revokeObjectURL(pendingCrop.previewUrl);
    },
    [pendingCrop],
  );

  const uploadClubImage = async (kind: "logo" | "banner", file: File) => {
    const { storageId, uploadIntentId } = await uploadFileToConvex(
      { generateUploadUrl: () => generateUploadUrl({ purpose: "CLUB_IMAGE" }) },
      file,
    );
    return finalizeClubImage({
      clubId: club._id,
      kind,
      uploadIntentId,
      storageId,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    });
  };

  const openEditor = () => {
    setForm({
      overview: club.overview ?? "",
      accentColor: club.accentColor ?? "",
      logoUrl: club.logoUrl ?? "",
      bannerUrl: club.bannerUrl ?? "",
      memberLimit: club.memberLimit?.toString() ?? "",
      joinPolicy: club.joinPolicy,
    });
    setEditing(true);
  };

  const handleUpload = async (kind: "logo" | "banner", file: File) => {
    const setBusy = kind === "logo" ? setUploadingLogo : setUploadingBanner;
    setBusy(true);
    try {
      const uploaded = await uploadClubImage(kind, file);
      setForm((c) => ({
        ...c,
        [kind === "logo" ? "logoUrl" : "bannerUrl"]: uploaded.url,
      }));
      return true;
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Upload failed",
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const beginCrop = (kind: "logo" | "banner", file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Not an image",
        description: "Pick a JPG, PNG, GIF, or WebP file.",
        variant: "destructive",
      });
      return;
    }
    setPendingCrop({ kind, file, previewUrl: URL.createObjectURL(file) });
  };

  const handleCropConfirm = async (file: File) => {
    if (!pendingCrop) return;
    const uploaded = await handleUpload(pendingCrop.kind, file);
    if (!uploaded) return;
    toast({
      title: pendingCrop.kind === "logo" ? "Club logo updated" : "Club banner updated",
    });
    setPendingCrop(null);
  };

  const handleSave = () => {
    const memberLimitText = form.memberLimit.trim();
    let memberLimit: number | null = null;
    if (memberLimitText) {
      memberLimit = Number(memberLimitText);
      if (!Number.isInteger(memberLimit) || memberLimit < 1) {
        toast({
          title: "Member limit must be a positive whole number",
          variant: "destructive",
        });
        return;
      }
    }

    void updateClub({
      clubId: club._id,
      overview: form.overview || undefined,
      accentColor: form.accentColor || undefined,
      memberLimit,
      joinPolicy: form.joinPolicy,
    }).then(() => {
      toast({ title: "Club branding saved" });
      setEditing(false);
    });
  };

  const bannerUrl = resolveMediaUrl(club.bannerUrl);
  const logoUrl = resolveMediaUrl(club.logoUrl);
  const accent = club.accentColor || undefined;
  const clubInitial = club.name.trim().charAt(0).toUpperCase() || "C";
  const cropDialog = (
    <ImageCropDialog
      open={Boolean(pendingCrop)}
      onOpenChange={(open) => {
        if (!open) setPendingCrop(null);
      }}
      imageSrc={pendingCrop?.previewUrl ?? null}
      fileName={pendingCrop?.file.name}
      aspectRatio={pendingCrop?.kind === "banner" ? 3 : 1}
      outputWidth={pendingCrop?.kind === "banner" ? 1536 : 512}
      title={pendingCrop?.kind === "banner" ? "Adjust banner" : "Adjust club logo"}
      saveLabel={pendingCrop?.kind === "banner" ? "Save banner" : "Save logo"}
      confirming={pendingCrop?.kind === "banner" ? uploadingBanner : uploadingLogo}
      onConfirm={handleCropConfirm}
    />
  );

  return (
    <>
      <section className={cn("overflow-hidden rounded-lg border border-border/70 bg-card", CARD_SURFACE_FOREGROUND)}>
        <div
          className={cn(
            "group/banner relative h-24 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-muted",
            !bannerUrl && "ring-1 ring-inset ring-border/40",
          )}
          style={
            bannerUrl
              ? {
                  backgroundImage: `url(${bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : accent
                ? {
                    background: `linear-gradient(135deg, ${accent}, ${accent}33)`,
                  }
                : undefined
          }
        >
          {canEdit && !editing ? (
            <div className="absolute right-2 top-2 flex items-center gap-2">
              <FileInput
                accept="image/*"
                loading={uploadingBanner}
                onFileSelect={(file) => beginCrop("banner", file)}
              >
                {({ disabled, open }) => (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leadingIcon={Pencil}
                    disabled={disabled}
                    onClick={open}
                    className="h-8 bg-background/90 px-2.5 opacity-0 backdrop-blur transition-opacity group-hover/banner:opacity-100 group-focus-within/banner:opacity-100 [@media(pointer:coarse)]:opacity-100 hover:bg-background"
                  >
                    Edit banner
                  </Button>
                )}
              </FileInput>
              <Tooltip content="Customize club home" side="left">
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={openEditor}
                  aria-label="Customize club home"
                  className="bg-background/90 backdrop-blur hover:bg-background"
                >
                  <Settings2 />
                </Button>
              </Tooltip>
            </div>
          ) : null}
        </div>

        <div className="relative space-y-3 px-4 pb-4 pt-3">
          <EditableAvatar
            alt={club.name}
            canEdit={canEdit && !editing}
            containerClassName="absolute -top-8 left-4 size-16"
            className="size-full rounded-xl border-4 border-background bg-muted"
            fallback={clubInitial}
            fallbackClassName="rounded-xl bg-gradient-to-br from-orange-500/20 via-amber-500/20 to-background text-lg text-orange-100"
            fallbackStyle={
              accent
                ? {
                    background: `linear-gradient(135deg, ${accent}55, ${accent}22)`,
                  }
                : undefined
            }
            imageUrl={logoUrl}
            loading={uploadingLogo}
            onUpload={(file) => beginCrop("logo", file)}
            uploadLabel="Change club logo"
          />
          <div className="pt-6">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {club.name}
              </h1>
              {club.description ? (
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {club.description}
                </p>
              ) : null}
            </div>
          </div>

          {club.overview ? (
            <p className="whitespace-pre-line text-sm leading-5 text-muted-foreground">
              {club.overview}
            </p>
          ) : null}
        </div>
      </section>

      {!editing ? cropDialog : null}

      {canEdit ? (
        <Dialog
          open={editing}
          onOpenChange={(open) => (open ? openEditor() : setEditing(false))}
        >
          <DialogContent size="lg" className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Customize club home</DialogTitle>
              <DialogDescription>
                Update the visual identity and joining details members see
                first.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <section
                className="space-y-3"
                aria-labelledby="club-branding-heading"
              >
                <h3
                  id="club-branding-heading"
                  className="text-sm font-semibold"
                >
                  Branding
                </h3>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <Field>
                    <FieldLabel>Banner image</FieldLabel>
                    <div
                      className="h-20 overflow-hidden rounded-md border border-border/70 bg-muted bg-cover bg-center"
                      style={
                        form.bannerUrl
                          ? {
                              backgroundImage: `url(${resolveMediaUrl(form.bannerUrl)})`,
                            }
                          : undefined
                      }
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <FileInput
                        accept="image/*"
                        label="Upload banner"
                        loading={uploadingBanner}
                        onFileSelect={(file) => beginCrop("banner", file)}
                      />
                      {form.bannerUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          leadingIcon={Trash2}
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            void clearClubImage({
                              clubId: club._id,
                              kind: "banner",
                            }).then(() =>
                              setForm((c) => ({ ...c, bannerUrl: "" })),
                            )
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </Field>

                  <div className="space-y-4">
                    <Field>
                      <FieldLabel>Logo</FieldLabel>
                      <EditableAvatar
                        alt={club.name}
                        canEdit={canEdit}
                        className="size-16 rounded-md"
                        fallback={clubInitial}
                        fallbackClassName="rounded-md bg-muted text-muted-foreground"
                        imageUrl={resolveMediaUrl(form.logoUrl)}
                        loading={uploadingLogo}
                        onRemove={() =>
                          void clearClubImage({
                            clubId: club._id,
                            kind: "logo",
                          }).then(() => setForm((c) => ({ ...c, logoUrl: "" })))
                        }
                        onUpload={(file) => beginCrop("logo", file)}
                        removeLabel="Remove logo"
                        uploadLabel="Upload logo"
                        variant="inline"
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Accent color</FieldLabel>
                      <ColorPickerPopover
                        value={form.accentColor || "#6366f1"}
                        onValueChange={(accentColor) =>
                          setForm((c) => ({ ...c, accentColor }))
                        }
                        hideAlpha
                        swatches={[
                          "#6366f1",
                          "#0ea5e9",
                          "#14b8a6",
                          "#f59e0b",
                          "#ef4444",
                          "#a855f7",
                        ]}
                        triggerShowRemove={Boolean(form.accentColor)}
                        onTriggerRemove={() =>
                          setForm((c) => ({ ...c, accentColor: "" }))
                        }
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <section
                className="space-y-4 border-t border-border/70 pt-5"
                aria-labelledby="club-details-heading"
              >
                <h3 id="club-details-heading" className="text-sm font-semibold">
                  Details
                </h3>
                <Field>
                  <FieldLabel htmlFor="club-overview">
                    About this club
                  </FieldLabel>
                  <Textarea
                    id="club-overview"
                    placeholder="What is this club for? Add meeting details or a clear next step."
                    rows={4}
                    value={form.overview}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, overview: e.target.value }))
                    }
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="club-join-policy">Joining</FieldLabel>
                    <Select
                      value={form.joinPolicy}
                      onValueChange={(joinPolicy) =>
                        setForm((current) => ({
                          ...current,
                          joinPolicy: joinPolicy as typeof current.joinPolicy,
                        }))
                      }
                    >
                      <SelectTrigger id="club-join-policy" />
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem index={0} value="OPEN">
                            Open join
                          </SelectItem>
                          <SelectItem index={1} value="REQUEST">
                            Request approval
                          </SelectItem>
                          <SelectItem index={2} value="INVITE_ONLY">
                            Invite only
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      Choose how new members are added.
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="club-member-limit">
                      Member limit
                    </FieldLabel>
                    <Input
                      id="club-member-limit"
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      placeholder="Unlimited"
                      value={form.memberLimit}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          memberLimit: e.target.value,
                        }))
                      }
                    />
                    <FieldDescription>
                      Leave blank for no limit.
                    </FieldDescription>
                  </Field>
                </div>
              </section>
            </div>

            {editing ? cropDialog : null}

            <DialogFooter>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
