"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { FileSpreadsheet } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseClubStructureCsv } from "@/lib/parse-club-structure-csv";
import { useToast } from "@/hooks/use-toast";

type StructurePreview = {
  line: number;
  name: string;
  parent: string;
  kind: string;
  issue: string | null;
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function BulkStructureImportDialog({ clubId }: { clubId: Id<"clubs"> }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StructurePreview[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const hierarchy = useQuery(api.clubs.hierarchy.list, open ? { clubId } : "skip");
  const bulkCreate = useMutation(api.clubs.hierarchy.bulkCreate);

  const blocked = useMemo(() => preview.filter((row) => row.issue), [preview]);

  const reset = () => {
    setFile(null);
    setPreview([]);
    setFileKey((key) => key + 1);
  };

  const previewFile = async () => {
    if (!file || !hierarchy) return;
    try {
      const rows = parseClubStructureCsv(await file.text());
      const names = new Set(hierarchy.units.map((unit) => normalize(unit.name)));
      rows.forEach((row) => names.add(normalize(row.name)));
      setPreview(rows.map((row) => ({
        ...row,
        issue: !row.name
          ? "Name is required"
          : row.parent && !names.has(normalize(row.parent))
            ? "Parent is not in this file or club"
            : null,
      })));
    } catch (error) {
      setPreview([]);
      toast({
        title: error instanceof Error ? error.message : "Could not read CSV",
        variant: "destructive",
      });
    }
  };

  const apply = async () => {
    if (!preview.length || blocked.length) return;
    setSaving(true);
    try {
      const result = await bulkCreate({
        clubId,
        units: preview.map((row) => ({
          name: row.name,
          parentName: row.parent || null,
          kind: row.kind || undefined,
        })),
      });
      toast({
        title: "Club structure imported",
        description: `${result.created} units created${result.existing ? `, ${result.existing} already existed` : ""}`,
      });
      setOpen(false);
      reset();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Could not import structure",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <Button
        type="button"
        size="sm"
        variant="tertiary"
        leadingIcon={FileSpreadsheet}
        onClick={() => setOpen(true)}
      >
        Import structure
      </Button>
      <DialogContent size="lg" className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import club structure</DialogTitle>
          <DialogDescription>
            Upload <code>name,parent,kind</code>. Missing units are created in
            parent-first order; existing matching units are left unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="structure-csv">Structure CSV</Label>
              <Input
                key={fileKey}
                id="structure-csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview([]);
                }}
              />
            </div>
            <Button type="button" variant="tertiary" disabled={!file || !hierarchy} onClick={() => void previewFile()}>
              Preview CSV
            </Button>
          </div>
          {preview.length ? (
            <>
              <p className="text-sm">
                {preview.length - blocked.length} ready
                {blocked.length ? ` · ${blocked.length} need attention` : ""}
              </p>
              <div className="max-h-72 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, index) => (
                      <TableRow key={`${row.line}-${row.name}`} index={index}>
                        <TableCell>{row.line}</TableCell>
                        <TableCell>{row.name || "—"}</TableCell>
                        <TableCell>{row.parent || "—"}</TableCell>
                        <TableCell>{row.kind || "—"}</TableCell>
                        <TableCell className={row.issue ? "text-destructive" : "text-foreground"}>
                          {row.issue ?? "Ready"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="tertiary" disabled={saving} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!preview.length || blocked.length > 0 || saving} loading={saving} onClick={() => void apply()}>
            Create structure
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
