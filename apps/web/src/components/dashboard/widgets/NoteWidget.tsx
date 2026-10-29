"use client";

import { useState } from "react";
import { api } from "~/apps/convex/src/_generated/api";
import { useCurrentUser } from "@/lib/auth";
import { useMutation } from "@/lib/convex-react";
import { Panel } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownBody } from "@/components/ui/markdown-body";

export function NoteWidget({ id, layoutEditing = false }: { id?: string; layoutEditing?: boolean }) {
  const user = useCurrentUser();
  const update = useMutation(api.users.me.updateDashboardNote);
  const note = user?.dashboardNotes?.find((item) => item.id === id);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const start = () => {
    if (layoutEditing || !id) return;
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setError("");
    setEditing(true);
  };
  const save = async () => {
    if (!id || saving) return;
    setSaving(true);
    try {
      await update({ id, title, body });
      setEditing(false);
    } catch {
      setError("Could not save your note. Try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div onDoubleClick={(event) => { if (!editing && !(event.target as HTMLElement).closest("a,button,input,textarea")) start(); }}>
    <Panel title={editing ? "Edit note" : (note?.title || "Untitled note")} action={!editing && !layoutEditing ? <Button size="sm" variant="ghost" onClick={start}>Edit</Button> : undefined}>
      {editing ? (
        <div className="flex flex-col gap-3" onKeyDown={(event) => { if (event.key === "Escape" && !saving) { event.stopPropagation(); setEditing(false); } }}>
          <Input aria-label="Note title" placeholder="Title" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          <Textarea aria-label="Note body (Markdown)" placeholder="Write in Markdown…" maxLength={20000} rows={5} value={body} onChange={(event) => setBody(event.target.value)} />
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2"><Button size="sm" onClick={() => void save()} loading={saving}>Save</Button><Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button></div>
        </div>
      ) : (
        <div>
          {note?.body ? <div className="typeset max-w-none text-sm"><MarkdownBody>{note.body}</MarkdownBody></div> : <p className="text-sm text-muted-foreground">{layoutEditing ? "Save your layout to edit this note." : "Double-click or choose Edit to write a note."}</p>}
        </div>
      )}
    </Panel>
    </div>
  );
}
