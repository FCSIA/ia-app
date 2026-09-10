"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useAction, useMutation, useQuery } from "@/lib/convex-react";
import type { FunctionReturnType } from "convex/server";
import {
  Check,
  GitBranch,
  QrCode,
  Send,
  RectangleEllipsis,
  Upload,
  UserMinus,
  UserPlus,
  UserPen,
  UserRoundCheck,
  Users,
  UsersRound,
  ShieldCheck,
  X,
} from "lucide-react";
import { useClubId } from "../../club-route";
import type { ClubDetail, ClubDirectoryEntry } from "@/components/clubs/types";
import type { Id } from "~/apps/convex/src/_generated/dataModel";
import { ClubWorkspace } from "@/components/clubs/club-workspace";
import { ClubAvatar } from "@/components/clubs/club-avatar";
import { CARD_SURFACE_FOREGROUND } from "@/lib/surface-classes";
import { UserProfileDialog } from "@/components/clubs/user-profile-dialog";
import { SetRoleDialog } from "@/components/clubs/dialogs/set-role-dialog";
import { UnitTreePicker } from "@/components/clubs/unit-tree-picker";
import { PeopleFilterPopover } from "@/components/clubs/people-filter-popover";
import type { PeopleKindFilter } from "@/components/clubs/people-filter-popover";
import { fullName } from "@/components/clubs/types";
import { IaQrCode } from "@/components/ui/ia-qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputCopy } from "@/components/ui/input-copy";
import { Label } from "@/components/ui/label";
import { SearchInput } from "@/components/ui/search";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabPanel, TabsList, TabItem } from "@/components/ui/tabs";
import { api } from "~/apps/convex/src/_generated/api";
import { parseInviteCsv } from "@/lib/parse-invite-csv";
import { parseUnitAssignmentCsv } from "@/lib/parse-unit-assignment-csv";
import { hasRole, useCurrentUser } from "@/lib/auth";
import { ImpersonateUserAction } from "@/components/auth/impersonate-user-action";
import { useToast } from "@/hooks/use-toast";
import { filterBySearchQuery } from "@/lib/search";
import { peopleSearchValues } from "@/lib/club-directory-search";

type StudentResult = FunctionReturnType<
  typeof api.clubs.invitations.searchInviteCandidates
>[number];

type BulkUploadResult =
  | {
      kind: "invites";
      invited: number;
      skipped: number;
      errors: string[];
    }
  | {
      kind: "members";
      added: number;
      alreadyMember: number;
      memberLimitReached: number;
      skipped: number;
      errors: string[];
    };

type UnitAssignmentPreview = {
  line: number;
  name: string;
  unit: string;
  role: string;
  memberId: Id<"users"> | null;
  unitId: Id<"clubUnits"> | null;
  issue: string | null;
  skipped: boolean;
};

const subscribeToOrigin = () => () => undefined;
const getClientOrigin = () => window.location.origin;
const getServerOrigin = () => "";

function ManagePeopleDialog({
  club,
  open,
  onOpenChange,
}: {
  club: ClubDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const clubId = useClubId();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [selected, setSelected] = useState<StudentResult | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvKey, setCsvKey] = useState(0);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const origin = useSyncExternalStore(
    subscribeToOrigin,
    getClientOrigin,
    getServerOrigin,
  );

  const generateJoinCode = useMutation(api.clubs.invitations.generateJoinCode);

  const searchResults =
    useQuery(
      api.clubs.invitations.searchInviteCandidates,
      deferredQuery.length >= 2 && !selected
        ? { clubId, query: deferredQuery, limit: 20 }
        : "skip",
    ) ?? [];
  const isSearching =
    deferredQuery.length >= 2 && !selected && searchResults.length === 0;

  const sendInvite = useMutation(api.clubs.invitations.sendInvite);
  const addMemberDirectly = useMutation(
    api.clubs.invitations.addMemberDirectly,
  );
  const bulkInvite = useMutation(api.clubs.invitations.bulkInvite);
  const bulkAddMembers = useAction(api.clubs.invitations.bulkAddMembers);
  const [csvPending, setCsvPending] = useState(false);
  const [memberActionPending, setMemberActionPending] = useState(false);

  const handleMemberAction = async (action: "add" | "invite") => {
    if (!selected) return;
    setMemberActionPending(true);
    try {
      if (action === "add") {
        const result = await addMemberDirectly({
          clubId,
          recipientUniqueId: selected.uniqueId,
        });
        if (result.kind === "memberLimitReached") {
          toast({
            title: "Club is full",
            description: "Open a member spot before adding another student.",
            variant: "destructive",
          });
          return;
        }
      } else {
        await sendInvite({ clubId, recipientUniqueId: selected.uniqueId });
      }
      setSelected(null);
      setQuery("");
      toast({
        title: action === "add" ? "Student added to club" : "Invite sent",
      });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Could not update membership",
        variant: "destructive",
      });
    } finally {
      setMemberActionPending(false);
    }
  };

  const handleCsvUpload = async (mode: "add" | "invite") => {
    if (!csvFile) return;
    setCsvPending(true);
    try {
      const uniqueIds = parseInviteCsv(await csvFile.text());
      if (mode === "add") {
        const response = await bulkAddMembers({ clubId, uniqueIds });
        setResult({ kind: "members", ...response });
        toast({
          title:
            response.memberLimitReached > 0
              ? "Club member limit reached"
              : "Students added",
          description:
            response.memberLimitReached > 0
              ? `${response.added} added. ${response.memberLimitReached} could not be added because the club is full.`
              : `${response.added} added, ${response.alreadyMember} already in club, ${response.skipped} skipped`,
          ...(response.memberLimitReached > 0
            ? { variant: "destructive" as const }
            : {}),
        });
      } else {
        const response = await bulkInvite({ clubId, uniqueIds });
        setResult({ kind: "invites", ...response });
        toast({
          title: "CSV processed",
          description: `${response.invited} invited, ${response.skipped} skipped`,
        });
      }
      setCsvFile(null);
      setCsvKey((key) => key + 1);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to import CSV",
        variant: "destructive",
      });
    } finally {
      setCsvPending(false);
    }
  };

  const joinUrl =
    origin && club.activeJoinCode?.code
      ? `${origin}/clubs/${club._id}?joinCode=${club.activeJoinCode.code}`
      : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>
            Choose the fastest way to bring students into this club.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="qr" className="w-full">
          <TabsList>
            <TabItem value="qr" label="QR" icon={QrCode} />
            <TabItem value="code" label="Code" icon={RectangleEllipsis} />
            <TabItem value="single" label="Single" icon={UserPlus} />
            <TabItem value="bulk" label="Bulk" icon={Upload} />
          </TabsList>

          <TabPanel value="qr" className="mt-4">
            <div className="flex flex-col items-center gap-4 rounded-lg border p-5 text-center">
              {joinUrl ? (
                <>
                  <IaQrCode
                    value={joinUrl}
                    label="Club join QR code"
                    className="size-56"
                  />
                  <InputCopy
                    value={joinUrl}
                    variant="button"
                    className="w-full max-w-sm"
                  />
                </>
              ) : (
                <>
                  <QrCode className="size-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Generate a join code first to create a QR link.
                  </p>
                  <Button
                    onClick={() =>
                      void generateJoinCode({ clubId }).then(() =>
                        toast({ title: "Join code generated" }),
                      )
                    }
                  >
                    Generate join code
                  </Button>
                </>
              )}
            </div>
          </TabPanel>

          <TabPanel value="code" className="mt-4">
            <div className="flex flex-col gap-4 rounded-lg border p-5">
              {club.activeJoinCode?.code ? (
                <div className="rounded-lg bg-muted/40 p-3">
                  <InputCopy
                    value={club.activeJoinCode.code}
                    label="Active code"
                    variant="button"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Generated{" "}
                    {club.activeJoinCode.updatedAt
                      ? formatDistanceToNow(
                          new Date(club.activeJoinCode.updatedAt),
                          { addSuffix: true },
                        )
                      : "recently"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active join code yet.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    void generateJoinCode({ clubId }).then(() =>
                      toast({ title: "Join code generated" }),
                    )
                  }
                >
                  {club.activeJoinCode?.code
                    ? "Regenerate code"
                    : "Generate code"}
                </Button>
              </div>
            </div>
          </TabPanel>

          <TabPanel value="single" className="mt-4">
            <div className="flex flex-col gap-3">
              {selected ? (
                <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {selected.firstName[0]}
                    {selected.lastName[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{fullName(selected)}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelected(null);
                      setQuery("");
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={memberActionPending}
                    loading={memberActionPending}
                    onClick={() => void handleMemberAction("add")}
                  >
                    Add now
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    leadingIcon={Send}
                    disabled={memberActionPending}
                    onClick={() => void handleMemberAction("invite")}
                  >
                    Invite
                  </Button>
                </div>
              ) : (
                <Command className="rounded-lg border" shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by name..."
                    value={query}
                    onValueChange={setQuery}
                  />
                  <CommandList className="max-h-[220px]">
                    {deferredQuery.length < 2 ? (
                      <div className="py-5 text-center text-sm text-muted-foreground">
                        Type at least 2 characters to search.
                      </div>
                    ) : isSearching ? (
                      <div className="py-5 text-center text-sm text-muted-foreground">
                        Searching...
                      </div>
                    ) : searchResults?.length === 0 ? (
                      <CommandEmpty>No students found.</CommandEmpty>
                    ) : (
                      <CommandGroup heading="Results">
                        {searchResults?.map((student) => (
                          <CommandItem
                            key={student._id}
                            onSelect={() => setSelected(student)}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2.5"
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                              {student.firstName[0]}
                              {student.lastName[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">
                                {fullName(student)}
                              </p>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              )}
            </div>
          </TabPanel>

          <TabPanel value="bulk" className="mt-4">
            <div className="flex flex-col gap-3 rounded-lg border p-5">
              <div className="space-y-1">
                <Label htmlFor="invite-csv">Unique ID CSV upload</Label>
                <p className="text-xs text-muted-foreground">
                  Use one student unique ID per row. Add students immediately to
                  leave existing members unchanged, or send invitations. Assign
                  houses, rooms, and roles afterward with Import units.
                </p>
              </div>
              <Input
                key={csvKey}
                id="invite-csv"
                type="file"
                accept=".csv"
                onChange={(event) =>
                  setCsvFile(event.target.files?.[0] || null)
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  leadingIcon={UserRoundCheck}
                  disabled={!csvFile || csvPending}
                  loading={csvPending}
                  onClick={() => void handleCsvUpload("add")}
                >
                  Add members now
                </Button>
                <Button
                  variant="tertiary"
                  leadingIcon={Upload}
                  disabled={!csvFile || csvPending}
                  onClick={() => void handleCsvUpload("invite")}
                >
                  Send invitations
                </Button>
              </div>
              {result ? (
                <div className="rounded-md bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {result.kind === "members"
                      ? `${result.added} added · ${result.alreadyMember} already in club · ${result.skipped} skipped`
                      : `${result.invited} invited · ${result.skipped} skipped`}
                  </p>
                  {result.kind === "members" &&
                  result.memberLimitReached > 0 ? (
                    <p className="mt-2 rounded-md border border-destructive/25 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                      {`The club is full. ${result.memberLimitReached} ${
                        result.memberLimitReached === 1
                          ? "student was"
                          : "students were"
                      } not added.`}
                    </p>
                  ) : null}
                  {result.errors.slice(0, 5).map((error) => (
                    <p
                      key={error}
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      {error}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </TabPanel>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function normalizeAssignmentMatch(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

const MAX_BULK_UNIT_ASSIGNMENT_ROWS = 100;

function BulkUnitAssignmentDialog({ club }: { club: ClubDetail }) {
  const clubId = useClubId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [preview, setPreview] = useState<UnitAssignmentPreview[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const hierarchy = useQuery(
    api.clubs.hierarchy.list,
    open ? { clubId } : "skip",
  );
  const bulkImportMembers = useMutation(api.clubs.hierarchy.bulkImportMembers);

  const previewSummary = useMemo(() => {
    const matched = preview.filter((row) => row.issue === null);
    const skipped = preview.filter((row) => row.skipped);
    const blocked = preview.length - matched.length - skipped.length;
    return { matched, skipped, blocked };
  }, [preview]);

  const reset = () => {
    setFile(null);
    setFileKey((key) => key + 1);
    setPreview([]);
    setIsApplying(false);
  };

  const buildPreview = async () => {
    if (!file || !hierarchy) return;
    try {
      const rows = parseUnitAssignmentCsv(await file.text());
      if (rows.length > MAX_BULK_UNIT_ASSIGNMENT_ROWS) {
        throw new Error(
          `A CSV import can assign up to ${MAX_BULK_UNIT_ASSIGNMENT_ROWS} rows at a time`,
        );
      }
      const memberByName = new Map<string, ClubDirectoryEntry[]>();
      for (const person of club.directory) {
        if (person.kind !== "MEMBER") continue;
        const key = normalizeAssignmentMatch(fullName(person));
        const matches = memberByName.get(key) ?? [];
        matches.push(person);
        memberByName.set(key, matches);
      }
      const unitByName = new Map<string, typeof hierarchy.units>();
      for (const unit of hierarchy.units) {
        const key = normalizeAssignmentMatch(unit.name);
        const matches = unitByName.get(key) ?? [];
        matches.push(unit);
        unitByName.set(key, matches);
      }

      setPreview(
        rows.map((row) => {
          if (!row.name || (!row.unit && !row.role)) {
            return {
              ...row,
              memberId: null,
              unitId: null,
              issue: "Name and unit are required",
              skipped: false,
            };
          }
          const members =
            memberByName.get(normalizeAssignmentMatch(row.name)) ?? [];
          const units =
            unitByName.get(normalizeAssignmentMatch(row.unit)) ?? [];
          const issue =
            members.length === 0
              ? "Skipped — not a club member"
              : members.length > 1
                ? "Name matches more than one club member"
                : row.unit && units.length === 0
                  ? "No active unit with this name"
                  : row.unit && units.length > 1
                    ? "Unit name is ambiguous"
                    : null;
          return {
            ...row,
            memberId:
              issue === "Skipped — not a club member"
                ? null
                : (members[0]?._id ?? null),
            unitId: issue || !row.unit ? null : units[0]._id,
            issue,
            skipped: issue === "Skipped — not a club member",
          };
        }),
      );
    } catch (error) {
      setPreview([]);
      toast({
        title: error instanceof Error ? error.message : "Could not read CSV",
        variant: "destructive",
      });
    }
  };

  const apply = async () => {
    if (!previewSummary.matched.length || previewSummary.blocked) return;
    setIsApplying(true);
    try {
      const unitRows = previewSummary.matched.filter((row) => row.unitId);
      const roleRows = previewSummary.matched.filter((row) => row.role);
      const result = await bulkImportMembers({
        clubId,
        unitAssignments: unitRows.map((row) => ({
          memberId: row.memberId!,
          unitId: row.unitId!,
        })),
        roleAssignments: roleRows.map((row) => ({
          memberId: row.memberId!,
          roleName: row.role,
        })),
        replaceExisting,
      });
      toast({
        title: "Assignments updated",
        description: `${result.assignedUnits} units and ${result.assignedRoles} roles assigned${result.skippedRoles ? `, ${result.skippedRoles} non-members skipped` : ""}${result.removed ? `, ${result.removed} previous assignments removed` : ""}${result.createdRoles ? `, ${result.createdRoles} roles created` : ""}`,
      });
      setOpen(false);
      reset();
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Could not apply assignments",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
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
        leadingIcon={UserPen}
        onClick={() => setOpen(true)}
        aria-label="Import unit assignments"
        title="Import unit assignments"
      >
        Import units
      </Button>

      <DialogContent size="lg" className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import unit assignments</DialogTitle>
          <DialogDescription>
            Upload a CSV with <code>name</code> and <code>unit</code> columns.
            Names and unit labels must match this club exactly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="unit-assignment-csv">CSV file</Label>
              <Input
                key={fileKey}
                id="unit-assignment-csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview([]);
                }}
              />
            </div>
            <Button
              type="button"
              variant="tertiary"
              disabled={!file || !hierarchy}
              onClick={() => void buildPreview()}
            >
              Preview CSV
            </Button>
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
            <Checkbox
              checked={replaceExisting}
              onCheckedChange={(checked) =>
                setReplaceExisting(checked === true)
              }
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-foreground">
                Replace direct assignments
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Remove each listed student’s current direct unit assignments
                before adding the CSV assignment.
              </span>
            </span>
          </label>

          {preview.length ? (
            <>
              <div className="flex items-baseline justify-between text-sm">
                <p className="font-medium text-foreground">
                  {previewSummary.matched.length} ready to assign
                </p>
                {previewSummary.blocked ? (
                  <p className="text-destructive">
                    {previewSummary.blocked} need attention
                  </p>
                ) : previewSummary.skipped.length ? (
                  <p className="text-muted-foreground">
                    {previewSummary.skipped.length} not in this club will be
                    skipped
                  </p>
                ) : null}
              </div>
              <ScrollArea className="h-72 rounded-md border border-border/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, index) => (
                      <TableRow
                        key={`${row.line}-${row.name}-${row.unit}`}
                        index={index}
                      >
                        <TableCell>{row.line}</TableCell>
                        <TableCell className="text-foreground">
                          {row.name || "—"}
                        </TableCell>
                        <TableCell>{row.unit || "—"}</TableCell>
                        <TableCell>{row.role || "—"}</TableCell>
                        <TableCell
                          className={
                            row.issue ? "text-destructive" : "text-foreground"
                          }
                        >
                          {row.issue ?? "Ready"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="tertiary"
            onClick={() => setOpen(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              !previewSummary.matched.length ||
              previewSummary.blocked > 0 ||
              isApplying
            }
            loading={isApplying}
            onClick={() => void apply()}
          >
            Apply assignments
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ClubPeoplePage() {
  const clubId = useClubId();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [manageOpen, setManageOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ClubDirectoryEntry | null>(
    null,
  );
  const [isRemoving, setIsRemoving] = useState(false);
  const [requestInFlight, setRequestInFlight] = useState<string | null>(null);
  const [friendRequestPendingId, setFriendRequestPendingId] = useState<
    string | null
  >(null);

  const [filter, setFilter] = useState(() =>
    searchParams?.get("tab") === "requests" ? "requests" : "all",
  );

  useEffect(() => {
    if (searchParams?.get("tab") === "requests") setFilter("requests");
  }, [searchParams]);

  const club = useQuery(api.clubs.detail.get, { clubId }) as
    ClubDetail | undefined;
  const removeMember = useMutation(api.clubs.management.removeMember);
  const respondToJoinRequest = useMutation(
    api.clubs.invitations.respondToJoinRequest,
  );
  const initializeRoles = useMutation(api.clubs.management.initializeRoles);
  const sendFriendRequest = useMutation(api.schedule.friends.sendRequest);

  const canAssignRoles = !!club?.viewer.permissions.assignRoles;
  const canManageStructure = !!club?.viewer.permissions.manageClubStructure;
  const canRemoveMembers = !!club?.viewer.permissions.removeMembers;
  const canApproveRequests = !!club?.viewer.permissions.manageJoinRequests;
  const canInvite = !!club?.viewer.permissions.inviteMembers;
  const peopleGroups = useQuery(
    api.clubs.peopleGroups.list,
    club ? { clubId } : "skip",
  );
  const hierarchy = useQuery(
    api.clubs.hierarchy.list,
    club ? { clubId } : "skip",
  );
  const [selectedUnitId, setSelectedUnitId] = useState<Id<"clubUnits"> | null>(
    null,
  );
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<Id<"clubRoles">>>(
    () => new Set(),
  );
  const [kindFilter, setKindFilter] = useState<PeopleKindFilter>("all");

  useEffect(() => {
    if (canAssignRoles && club?.roles.length === 0) {
      void initializeRoles({ clubId }).catch((error) => {
        toast({
          title:
            error instanceof Error
              ? error.message
              : "Could not initialize roles",
          variant: "destructive",
        });
      });
    }
  }, [canAssignRoles, club?.roles.length, clubId, initializeRoles, toast]);

  useEffect(() => {
    setSelectedUnitId(null);
    setSelectedRoleIds(new Set());
    setKindFilter("all");
  }, [clubId]);

  useEffect(() => {
    if (
      selectedUnitId &&
      hierarchy &&
      !hierarchy.units.some((unit) => unit._id === selectedUnitId)
    ) {
      setSelectedUnitId(null);
    }
  }, [hierarchy, selectedUnitId]);

  useEffect(() => {
    if (!club) return;
    const validIds = new Set(club.roles.map((r) => r._id));
    setSelectedRoleIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      if (next.size === prev.size && [...next].every((id) => prev.has(id)))
        return prev;
      return next;
    });
  }, [club]);

  const directory = club?.directory;
  const pendingJoinRequests = club?.pendingJoinRequests ?? [];
  const visibleFilter =
    filter === "requests" && !canApproveRequests ? "all" : filter;
  const selectedGroupId = visibleFilter.startsWith("group:")
    ? (visibleFilter.slice(6) as Id<"clubPeopleGroups">)
    : null;
  const groupMemberIds = useQuery(
    api.clubs.peopleGroups.members,
    selectedGroupId ? { clubId, groupId: selectedGroupId } : "skip",
  );

  const stats = useMemo(() => {
    const people = directory ?? [];
    return {
      all: people.length,
      sponsors: people.filter((p) => p.kind === "SPONSOR").length,
      roleCounts: new Map(
        club?.roles.map((role) => [
          role._id,
          people.filter((person) => person.roleId === role._id).length,
        ]),
      ),
    };
  }, [club?.roles, directory]);

  const selectedUnitIds = useMemo(() => {
    if (!selectedUnitId || !hierarchy?.units) return null;
    const byParent = new Map<Id<"clubUnits"> | null, Id<"clubUnits">[]>();
    for (const unit of hierarchy.units) {
      const parent = unit.parentUnitId ?? null;
      const list = byParent.get(parent) ?? [];
      list.push(unit._id);
      byParent.set(parent, list);
    }
    const collected = new Set<Id<"clubUnits">>([selectedUnitId]);
    const stack: Id<"clubUnits">[] = [selectedUnitId];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const child of byParent.get(cur) ?? []) {
        if (!collected.has(child)) {
          collected.add(child);
          stack.push(child);
        }
      }
    }
    return collected;
  }, [selectedUnitId, hierarchy]);

  const matchesSelectedSubstructure = (person: ClubDirectoryEntry) =>
    !selectedUnitIds ||
    (
      ((person as unknown as { unitIds?: Id<"clubUnits">[] }).unitIds ??
        []) as Id<"clubUnits">[]
    ).some((id) => selectedUnitIds.has(id));

  const matchesSelectedRoles = (person: ClubDirectoryEntry) =>
    selectedRoleIds.size === 0 ||
    (!!person.roleId && selectedRoleIds.has(person.roleId as Id<"clubRoles">));

  const matchesKindFilter = (person: ClubDirectoryEntry) =>
    kindFilter === "all" || person.kind === kindFilter;

  const hasActivePopoverFilters =
    !!selectedUnitId || selectedRoleIds.size > 0 || kindFilter !== "all";

  const filtered = useMemo(() => {
    let result = filterBySearchQuery(
      directory ?? [],
      deferredSearch,
      peopleSearchValues,
    );

    if (selectedUnitIds) {
      result = result.filter(matchesSelectedSubstructure);
    }
    if (selectedRoleIds.size > 0) {
      result = result.filter(matchesSelectedRoles);
    }
    if (kindFilter !== "all") {
      result = result.filter(matchesKindFilter);
    }

    if (visibleFilter === "sponsors")
      result = result.filter((p) => p.kind === "SPONSOR");
    else if (visibleFilter.startsWith("role:")) {
      result = result.filter(
        (person) => person.roleId === visibleFilter.slice(5),
      );
    }

    return result;
  }, [
    deferredSearch,
    directory,
    visibleFilter,
    selectedUnitIds,
    selectedRoleIds,
    kindFilter,
  ]);

  const groupPeople = useMemo(() => {
    const memberIds = new Set(groupMemberIds?.memberIds ?? []);
    let result = (directory ?? []).filter((person) =>
      memberIds.has(person._id),
    );
    if (selectedUnitIds) {
      result = result.filter(matchesSelectedSubstructure);
    }
    if (selectedRoleIds.size > 0) {
      result = result.filter(matchesSelectedRoles);
    }
    if (kindFilter !== "all") {
      result = result.filter(matchesKindFilter);
    }
    return filterBySearchQuery(result, deferredSearch, peopleSearchValues);
  }, [
    deferredSearch,
    directory,
    groupMemberIds?.memberIds,
    selectedUnitIds,
    selectedRoleIds,
    kindFilter,
  ]);

  const visiblePeople = visibleFilter.startsWith("group:")
    ? groupPeople
    : filtered;
  const friendshipTargetIds = useMemo(
    () =>
      visiblePeople
        .filter((person) => person._id !== user?._id)
        .map((person) => person._id),
    [user?._id, visiblePeople],
  );
  const friendshipStatuses = useQuery(
    api.schedule.friends.getStatuses,
    user && friendshipTargetIds.length > 0
      ? { userIds: friendshipTargetIds }
      : "skip",
  );
  const friendshipStatusByUserId = useMemo(
    () =>
      new Map(
        friendshipStatuses?.map(({ userId, status }) => [userId, status]),
      ),
    [friendshipStatuses],
  );

  const selectedGroup = peopleGroups?.groups.find(
    (group) => group._id === selectedGroupId,
  );

  async function respondToRequest(
    requestId: Id<"clubJoinRequests">,
    accept: boolean,
  ) {
    setRequestInFlight(requestId);
    try {
      const result = await respondToJoinRequest({ clubId, requestId, accept });
      if (result.kind === "memberLimitReached") {
        toast({
          title: "Club is full",
          description:
            "A member spot must open before this request can be approved.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: accept ? "Join request approved" : "Join request declined",
      });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Unable to update join request",
        variant: "destructive",
      });
    } finally {
      setRequestInFlight(null);
    }
  }

  async function confirmRemoveMember() {
    if (!removeTarget) return;
    setIsRemoving(true);
    try {
      await removeMember({ clubId, memberId: removeTarget._id });
      toast({ title: `${fullName(removeTarget)} removed` });
      setRemoveTarget(null);
    } catch (error) {
      toast({
        title:
          error instanceof Error ? error.message : "Unable to remove member",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  }

  async function handleSendFriendRequest(friendId: string) {
    if (friendRequestPendingId) return;
    setFriendRequestPendingId(friendId);
    try {
      await sendFriendRequest({ friendId: friendId as Id<"users"> });
      toast({ title: "Friend request sent" });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Failed to send friend request",
        variant: "destructive",
      });
    } finally {
      setFriendRequestPendingId(null);
    }
  }

  const title = (
    <div className="min-w-0">
      <h1 className="truncate text-base font-semibold text-foreground">
        People
      </h1>
      <p className="truncate text-xs text-muted-foreground">
        {stats.all} {stats.all === 1 ? "person" : "people"} in this club
      </p>
    </div>
  );

  return (
    <ClubWorkspace
      title={title}
      contentClassName="flex flex-col overflow-hidden"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-3 sm:p-4">
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 flex-col gap-3">
            <Tabs
              value={visibleFilter}
              onValueChange={setFilter}
              className="min-w-0 w-full"
            >
              <div className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <TabsList>
                  <TabItem value="all" label={`All ${stats.all}`} />
                  {club?.roles
                    .filter((role) => role.showInDirectory)
                    .map((role) => (
                      <TabItem
                        key={role._id}
                        value={`role:${role._id}`}
                        label={`${role.name} ${stats.roleCounts.get(role._id) ?? 0}`}
                      />
                    ))}
                  <TabItem
                    value="sponsors"
                    label={`Sponsors ${stats.sponsors}`}
                  />
                  {canApproveRequests ? (
                    <TabItem
                      value="requests"
                      label={`Requests ${pendingJoinRequests.length}`}
                    />
                  ) : null}
                  {peopleGroups?.groups.map((group) => (
                    <TabItem
                      key={group._id}
                      value={`group:${group._id}`}
                      label={group.name}
                    />
                  ))}
                </TabsList>
              </div>
            </Tabs>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {visibleFilter !== "requests" ? (
                <PeopleFilterPopover
                  club={club}
                  hierarchy={hierarchy}
                  selectedUnitId={selectedUnitId}
                  onSelectedUnitIdChange={setSelectedUnitId}
                  selectedRoleIds={selectedRoleIds}
                  onSelectedRoleIdsChange={setSelectedRoleIds}
                  kindFilter={kindFilter}
                  onKindFilterChange={setKindFilter}
                  onClear={() => {
                    setSelectedUnitId(null);
                    setSelectedRoleIds(new Set());
                    setKindFilter("all");
                  }}
                />
              ) : null}
              {visibleFilter !== "requests" ? (
                <SearchInput
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search people, roles, or units"
                  size="sm"
                  className="order-last w-full sm:order-none sm:min-w-56 sm:flex-1"
                />
              ) : null}
              {club && canInvite ? (
                <Button
                  type="button"
                  size="sm"
                  leadingIcon={UserPlus}
                  onClick={() => setManageOpen(true)}
                  aria-label="Add members"
                  title="Add members"
                >
                  Add members
                </Button>
              ) : null}
              {club && canManageStructure ? (
                <BulkUnitAssignmentDialog club={club} />
              ) : null}
            </div>
          </div>

          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-card ${CARD_SURFACE_FOREGROUND}`}
          >
            {visibleFilter.startsWith("group:") ? (
              selectedGroup ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="border-b border-border/60 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {selectedGroup.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedGroup.description ||
                          "People matching this group’s rules"}
                      </p>
                    </div>
                  </div>
                  {groupPeople.length > 0 ? (
                    <ScrollArea className="min-h-0 flex-1">
                      <div className="divide-y divide-border/60">
                        {groupPeople.map((person) => (
                          <PersonRow
                            key={person._id}
                            person={person}
                            isCurrentUser={person._id === user?._id}
                            isFriend={
                              friendshipStatusByUserId.get(person._id) ===
                              "FRIENDS"
                            }
                            canSendFriendRequest={
                              friendshipStatusByUserId.get(person._id) ===
                              "NONE"
                            }
                            friendshipStatus={friendshipStatusByUserId.get(
                              person._id,
                            )}
                            friendRequestPending={
                              friendRequestPendingId === person._id
                            }
                            onSendFriendRequest={handleSendFriendRequest}
                            canAssignRole={
                              canAssignRoles && person.kind === "MEMBER"
                            }
                            canManageUnits={
                              canManageStructure && person.kind === "MEMBER"
                            }
                            canRemove={
                              canRemoveMembers && person.kind === "MEMBER"
                            }
                            canImpersonate={Boolean(
                              user &&
                              hasRole(user, "SUPER_ADMIN") &&
                              !person.roles.some(
                                (role) =>
                                  role === "ADMIN" || role === "SUPER_ADMIN",
                              ),
                            )}
                            onRemove={setRemoveTarget}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                      <UsersRound className="mb-2 size-5 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-foreground">
                        {hasActivePopoverFilters
                          ? "No people match the current filters"
                          : "No people in this group"}
                      </h3>
                      <p className="mt-1 max-w-72 text-xs text-muted-foreground">
                        {hasActivePopoverFilters
                          ? "No one in this group matches the selected filters."
                          : "Add roles, people, or structure branches to change who appears here."}
                      </p>
                      {hasActivePopoverFilters ? (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedUnitId(null);
                            setSelectedRoleIds(new Set());
                            setKindFilter("all");
                          }}
                          className="mt-2 text-primary font-semibold"
                        >
                          Clear filters
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                  <UsersRound className="mb-2 size-5 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">
                    No people groups yet
                  </h3>
                  <p className="mt-1 max-w-72 text-xs text-muted-foreground">
                    Create a group to organize people independently from roles
                    and units.
                  </p>
                </div>
              )
            ) : visibleFilter === "requests" ? (
              pendingJoinRequests.length > 0 ? (
                <ScrollArea className="min-h-0 flex-1">
                  <div className="divide-y divide-border/60">
                    {pendingJoinRequests.map((request) => {
                      const processing = requestInFlight === request._id;
                      return (
                        <div
                          key={request._id}
                          className="flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {fullName(request.requester)}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              Requested{" "}
                              {formatDistanceToNow(
                                new Date(request.createdAt),
                                { addSuffix: true },
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="tertiary"
                              disabled={requestInFlight !== null}
                              onClick={() =>
                                void respondToRequest(request._id, false)
                              }
                            >
                              Decline
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              leadingIcon={Check}
                              disabled={requestInFlight !== null}
                              onClick={() =>
                                void respondToRequest(request._id, true)
                              }
                            >
                              {processing ? "Updating…" : "Approve"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  No join requests are waiting for review.
                </div>
              )
            ) : filtered.length > 0 ? (
              <ScrollArea className="min-h-0 flex-1">
                <div className="divide-y divide-border/60">
                  {filtered.map((person) => (
                    <PersonRow
                      key={person._id}
                      person={person}
                      isCurrentUser={person._id === user?._id}
                      isFriend={
                        friendshipStatusByUserId.get(person._id) === "FRIENDS"
                      }
                      canSendFriendRequest={
                        friendshipStatusByUserId.get(person._id) === "NONE"
                      }
                      friendshipStatus={friendshipStatusByUserId.get(
                        person._id,
                      )}
                      friendRequestPending={
                        friendRequestPendingId === person._id
                      }
                      onSendFriendRequest={handleSendFriendRequest}
                      canAssignRole={canAssignRoles && person.kind === "MEMBER"}
                      canManageUnits={
                        canManageStructure && person.kind === "MEMBER"
                      }
                      canRemove={canRemoveMembers && person.kind === "MEMBER"}
                      canImpersonate={Boolean(
                        user &&
                        hasRole(user, "SUPER_ADMIN") &&
                        !person.roles.some(
                          (role) => role === "ADMIN" || role === "SUPER_ADMIN",
                        ),
                      )}
                      onRemove={setRemoveTarget}
                    />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">
                <Users className="mb-2 size-5 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  No people found
                </h3>
                <p className="mt-1 max-w-64 text-xs text-muted-foreground">
                  {deferredSearch || hasActivePopoverFilters
                    ? "No people match the current filters."
                    : "No one is in this group yet."}
                </p>
                {(deferredSearch || hasActivePopoverFilters) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setSelectedUnitId(null);
                      setSelectedRoleIds(new Set());
                      setKindFilter("all");
                    }}
                    className="mt-2 text-primary font-semibold"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {club ? (
        <ManagePeopleDialog
          club={club}
          open={manageOpen}
          onOpenChange={setManageOpen}
        />
      ) : null}
      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isRemoving) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {removeTarget ? fullName(removeTarget) : "member"} from{" "}
              {club?.name ?? "this club"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this club and its channels. You can
              invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              Keep member
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isRemoving}
              onClick={(event) => {
                event.preventDefault();
                void confirmRemoveMember();
              }}
            >
              {isRemoving ? "Removing…" : "Remove from club"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClubWorkspace>
  );
}

function PersonRow({
  person,
  isCurrentUser,
  isFriend,
  canAssignRole,
  canManageUnits,
  canRemove,
  canImpersonate,
  canSendFriendRequest,
  friendshipStatus,
  friendRequestPending,
  onSendFriendRequest,
  onRemove,
}: {
  person: ClubDirectoryEntry;
  isCurrentUser: boolean;
  isFriend: boolean;
  canAssignRole: boolean;
  canManageUnits: boolean;
  canRemove: boolean;
  canImpersonate: boolean;
  canSendFriendRequest: boolean;
  friendshipStatus?: "NONE" | "REQUEST_SENT" | "REQUEST_RECEIVED" | "FRIENDS";
  friendRequestPending: boolean;
  onSendFriendRequest: (userId: string) => void;
  onRemove: (person: ClubDirectoryEntry) => void;
}) {
  const showManage =
    (canAssignRole || canManageUnits || canRemove || canImpersonate) &&
    person.kind === "MEMBER" &&
    !isCurrentUser;
  const isSponsor = person.kind === "SPONSOR";
  const [primaryUnitName, ...otherUnitNames] = person.unitNames;
  const unitMembershipLabel = person.unitNames.join(", ");
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <div className="group/person flex min-h-14 items-center gap-3 px-3 py-2 transition-colors hover:bg-hover">
        <button
          type="button"
          aria-label={`View ${fullName(person)} profile`}
          onClick={() => setProfileOpen(true)}
          className="shrink-0 rounded-full outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          <ClubAvatar
            person={person}
            className="size-9"
            fallbackClassName="text-[11px]"
          />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {fullName(person)}
          </p>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {isCurrentUser ? (
              <span
                className="inline-flex size-1.5 shrink-0 rounded-full bg-primary"
                role="img"
                aria-label="You"
                title="You"
              />
            ) : null}
            {isFriend ? (
              <span
                className="inline-flex shrink-0 text-primary"
                role="img"
                aria-label="Friend"
                title="Friend"
              >
                <UserRoundCheck className="size-3.5" aria-hidden />
              </span>
            ) : null}
            {isSponsor ? (
              <Badge
                variant="solid"
                className="h-5 shrink-0 gap-1 border-primary/20 bg-primary/5 px-1.5 py-0 text-primary hover:bg-primary/10"
              >
                <ShieldCheck className="size-3" />
                Sponsor
              </Badge>
            ) : person.roleName ? (
              <Badge
                variant="solid"
                className="h-5 shrink-0 border-border/70 bg-muted/60 px-1.5 py-0 text-muted-foreground"
              >
                {person.roleName}
              </Badge>
            ) : null}
            {primaryUnitName ? (
              <Badge
                variant="solid"
                size="sm"
                className="shrink-0 bg-muted/60 text-muted-foreground"
                title={unitMembershipLabel}
              >
                <GitBranch />
                {primaryUnitName}
              </Badge>
            ) : null}
            {otherUnitNames.length ? (
              <Badge
                variant="solid"
                size="sm"
                className="shrink-0 bg-muted/60 text-muted-foreground"
                title={unitMembershipLabel}
                aria-label={`${otherUnitNames.length} more unit ${
                  otherUnitNames.length === 1 ? "membership" : "memberships"
                }`}
              >
                +{otherUnitNames.length}
              </Badge>
            ) : null}
          </div>
        </div>
        {showManage ? (
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {canAssignRole ? <SetRoleDialog person={person} /> : null}
            {canManageUnits ? <UnitMembershipPopover person={person} /> : null}
            {canImpersonate ? (
              <ImpersonateUserAction
                userId={person._id}
                name={fullName(person)}
              />
            ) : null}
            {canRemove ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Remove ${fullName(person)} from club`}
                onClick={() => onRemove(person)}
              >
                <UserMinus className="size-4" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <UserProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        person={person}
        roleName={person.roleName}
        unitNames={person.unitNames}
        kind={person.kind}
        isCurrentUser={isCurrentUser}
        canSendFriendRequest={canSendFriendRequest}
        friendshipStatus={friendshipStatus}
        friendRequestPending={friendRequestPending}
        onSendFriendRequest={onSendFriendRequest}
      />
    </>
  );
}

function UnitMembershipPopover({ person }: { person: ClubDirectoryEntry }) {
  const clubId = useClubId();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pendingUnitId, setPendingUnitId] = useState<Id<"clubUnits"> | null>(
    null,
  );
  const options = useQuery(
    api.clubs.hierarchy.listMemberUnitOptions,
    open ? { clubId, memberId: person._id } : "skip",
  );
  const setMember = useMutation(api.clubs.hierarchy.setMember);
  const removeMember = useMutation(api.clubs.hierarchy.removeMember);
  const unitById = useMemo(
    () =>
      new Map<string, NonNullable<typeof options>["units"][number]>(
        (options?.units ?? []).map((unit) => [unit._id, unit]),
      ),
    [options?.units],
  );
  const assignedUnitId =
    pendingUnitId ?? options?.directMemberships[0]?.unitId ?? null;

  const addMembership = async (unitId: Id<"clubUnits">) => {
    if (unitById.get(unitId)?.disabled) return;
    setPendingUnitId(unitId);
    try {
      await setMember({
        clubId,
        unitId,
        memberId: person._id,
      });
      setOpen(false);
    } catch (error) {
      setPendingUnitId(null);
      toast({
        title: error instanceof Error ? error.message : "Could not assign unit",
        variant: "destructive",
      });
    }
  };

  const removeMembership = async (unitId: Id<"clubUnits">) => {
    try {
      await removeMember({ clubId, unitId, memberId: person._id });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Could not remove unit assignment",
        variant: "destructive",
      });
    }
  };

  return (
    <UnitTreePicker
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setPendingUnitId(null);
        }
      }}
      trigger={
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Assign ${fullName(person)} to a unit`}
          title="Assign unit"
        >
          <GitBranch className="size-4" />
        </Button>
      }
      units={options?.units ?? []}
      value={assignedUnitId}
      onValueChange={(unitId) => {
        if (unitId) void addMembership(unitId);
      }}
      title="Choose unit"
      subtitle={fullName(person)}
      ariaLabel={`Unit assignments for ${fullName(person)}`}
      loading={options === undefined}
      footer={
        options?.directMemberships.length ? (
          <>
            <Separator className="my-2" />
            <p className="px-2 pb-1 text-xs text-muted-foreground">Assigned</p>
            {options.directMemberships.map((membership) => {
              const unit = unitById.get(membership.unitId);
              return (
                <Button
                  key={membership.unitId}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  leadingIcon={X}
                  onClick={() => void removeMembership(membership.unitId)}
                >
                  Remove {unit?.name ?? "archived unit"}
                </Button>
              );
            })}
          </>
        ) : null
      }
    />
  );
}
