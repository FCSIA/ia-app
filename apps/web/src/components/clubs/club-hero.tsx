"use client";

import { useRef, useState } from "react";
import {
  ImagePlus,
  Loader2,
  Palette,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import type { ClubDetail } from "@/components/clubs/types";
import { Button } from "@/components/ui/button";
import { EditableAvatar } from "@/components/ui/editable-avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { uploadFileToConvex } from "@/lib/convex-upload";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  const finalizeClubImage = useMutation(api.uploads.files.finalizeClubImage);
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    overview: club.overview ?? "",
    accentColor: club.accentColor ?? "",
    logoUrl: club.logoUrl ?? "",
    bannerUrl: club.bannerUrl ?? "",
    memberLimit: club.memberLimit?.toString() ?? "",
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const uploadClubImage = async (file: File) => {
    const { storageId, uploadIntentId } = await uploadFileToConvex(
      { generateUploadUrl: () => generateUploadUrl({ purpose: "CLUB_IMAGE" }) },
      file,
    );
    return finalizeClubImage({
      uploadIntentId,
      storageId,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    });
  };

  const handleQuickLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const uploaded = await uploadClubImage(file);
      await updateClub({ clubId: club._id, logoUrl: uploaded.url });
      toast({ title: "Club logo updated" });

      setForm((c) => ({ ...c, logoUrl: uploaded.url }));
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const openEditor = () => {
    setForm({
      overview: club.overview ?? "",
      accentColor: club.accentColor ?? "",
      logoUrl: club.logoUrl ?? "",
      bannerUrl: club.bannerUrl ?? "",
      memberLimit: club.memberLimit?.toString() ?? "",
    });
    setEditing(true);
  };

  const handleUpload = async (kind: "logo" | "banner", file: File) => {
    const setBusy = kind === "logo" ? setUploadingLogo : setUploadingBanner;
    setBusy(true);
    try {
      const uploaded = await uploadClubImage(file);
      setForm((c) => ({
        ...c,
        [kind === "logo" ? "logoUrl" : "bannerUrl"]: uploaded.url,
      }));
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = () => {
    const memberLimitText = form.memberLimit.trim();
    let memberLimit: number | null = null;
    if (memberLimitText) {
      memberLimit = Number(memberLimitText);
      if (!Number.isInteger(memberLimit) || memberLimit < 1) {
        toast({ title: "Member limit must be a positive whole number", variant: "destructive" });
        return;
      }
    }

    void updateClub({
      clubId: club._id,
      overview: form.overview || undefined,
      accentColor: form.accentColor || undefined,
      logoUrl: form.logoUrl || undefined,
      bannerUrl: form.bannerUrl || undefined,
      memberLimit,
    }).then(() => {
      toast({ title: "Club branding saved" });
      setEditing(false);
    });
  };

  const bannerUrl = resolveMediaUrl(club.bannerUrl);
  const logoUrl = resolveMediaUrl(club.logoUrl);
  const accent = club.accentColor || undefined;
  const clubInitial = club.name.trim().charAt(0).toUpperCase() || "C";

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card">
      <div
        className={cn(
          "relative h-24 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-muted",
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
        {canEdit && !editing && (
          <Button
            variant="secondary"
            size="sm"
            onClick={openEditor}
            className="absolute right-2 top-2 h-8 gap-1.5 bg-background/90 px-2.5 backdrop-blur hover:bg-background"
          >
            <Settings2 className="size-3.5" /> Customize
          </Button>
        )}
      </div>

      <div className="relative -mt-8 space-y-3 px-4 pb-4">
        <div className="flex items-end gap-3">
          <EditableAvatar
            alt={club.name}
            canEdit={canEdit && !editing}
            className="size-16 rounded-xl border-4 border-background bg-muted"
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
            onUpload={(file) => void handleQuickLogoUpload(file)}
            uploadLabel="Change club logo"
          />
          <div className="min-w-0 pb-0.5">
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
          <p className="line-clamp-4 whitespace-pre-line text-sm leading-5 text-muted-foreground">
            {club.overview}
          </p>
        ) : null}

        {editing && canEdit && (
          <div className="space-y-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Customize club home</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Banner upload */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Banner image
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="h-16 w-40 shrink-0 overflow-hidden rounded-md border bg-background bg-cover bg-center"
                  style={
                    form.bannerUrl
                      ? {
                          backgroundImage: `url(${resolveMediaUrl(form.bannerUrl)})`,
                        }
                      : undefined
                  }
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload("banner", file);
                      if (bannerInputRef.current)
                        bannerInputRef.current.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="tertiary"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={uploadingBanner}
                  >
                    {uploadingBanner ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="mr-1.5 size-3.5" />
                    )}
                    Upload banner
                  </Button>
                  {form.bannerUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setForm((c) => ({ ...c, bannerUrl: "" }))}
                    >
                      <Trash2 className="mr-1.5 size-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Logo upload */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Logo / profile picture
              </label>
              <div className="flex items-center gap-3">
                <EditableAvatar
                  alt={club.name}
                  canEdit={canEdit}
                  className="size-16 rounded-md"
                  fallback={clubInitial}
                  fallbackClassName="rounded-md bg-muted text-muted-foreground"
                  imageUrl={resolveMediaUrl(form.logoUrl)}
                  loading={uploadingLogo}
                  onRemove={() => setForm((c) => ({ ...c, logoUrl: "" }))}
                  onUpload={(file) => void handleUpload("logo", file)}
                  removeLabel="Remove"
                  uploadLabel="Upload logo"
                  variant="inline"
                />
              </div>
            </div>

            {/* Accent color */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Palette className="size-3.5" /> Accent color
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={form.accentColor || "#6366f1"}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, accentColor: e.target.value }))
                  }
                  className="h-9 w-16 cursor-pointer p-1"
                />
                <Input
                  placeholder="#6366f1"
                  value={form.accentColor}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, accentColor: e.target.value }))
                  }
                  className="h-9 max-w-[160px]"
                />
                {form.accentColor && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setForm((c) => ({ ...c, accentColor: "" }))}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Overview */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                About this club
              </label>
              <Textarea
                placeholder="Tell members what this club is about, meeting times, goals…"
                rows={5}
                value={form.overview}
                onChange={(e) =>
                  setForm((c) => ({ ...c, overview: e.target.value }))
                }
              />
            </div>

            <Field>
              <FieldLabel htmlFor="club-member-limit">Member limit</FieldLabel>
              <Input
                id="club-member-limit"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="Unlimited"
                value={form.memberLimit}
                onChange={(e) => setForm((current) => ({ ...current, memberLimit: e.target.value }))}
              />
              <FieldDescription>
                Leave blank for no limit. New joins and approvals stop once the limit is reached.
              </FieldDescription>
            </Field>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave}>
                Save changes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
