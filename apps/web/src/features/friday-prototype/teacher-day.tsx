"use client";
import {
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Download,
  Presentation,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabItem, TabPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Choice,
  SessionTime,
  WorkshopName,
  WorkshopDirectory,
  exportCalendar,
} from "./workshop-table";
import {
  students,
  timeRange,
  type Attendance,
  type Workshop,
} from "./sample-data";
export function TeacherDay({
  workshops,
  allWorkshops,
  date,
  dateControl,
  requestStatus,
  attendance,
  studentBookings,
  setAttendance,
  onRequest,
}: {
  workshops: Workshop[];
  allWorkshops: Workshop[];
  date: string;
  dateControl: ReactNode;
  requestStatus?: "Pending" | "Approved" | "Declined";
  attendance: Record<string, Attendance>;
  studentBookings: string[];
  setAttendance: Dispatch<SetStateAction<Record<string, Attendance>>>;
  onRequest: (reason: string) => void;
}) {
  const [roster, setRoster] = useState<string | null>(null);
  const [tab, setTab] = useState("day");
  const rosterHeading = useRef<HTMLHeadingElement>(null);
  const openers = useRef(new Map<string, HTMLButtonElement>());
  const selected = workshops.find((item) => item.id === roster);
  const alexBooked = selected ? studentBookings.includes(selected.id) : false;
  const rosterStudents = [
    ...(alexBooked ? [{ id: "alex", name: "Alex Johnson", grade: 11 }] : []),
    ...students.slice(
      0,
      Math.max(0, (selected?.booked ?? 0) - (alexBooked ? 1 : 0)),
    ),
  ];
  const present = rosterStudents.filter(
    (student) => attendance[`${roster}:${student.id}`] === "Present",
  ).length;

  if (selected)
    return (
      <section className="space-y-5" aria-labelledby="roster-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <Button
              variant="ghost"
              leadingIcon={ArrowLeft}
              onClick={() => {
                setRoster(null);
                requestAnimationFrame(() =>
                  openers.current.get(selected.id)?.focus(),
                );
              }}
            >
              My day
            </Button>
            <div className="space-y-1">
              <h2
                ref={rosterHeading}
                tabIndex={-1}
                id="roster-heading"
                className="text-xl font-semibold text-foreground outline-none"
              >
                {selected.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selected.room} · {timeRange(selected)} · {selected.booked}{" "}
                students
              </p>
            </div>
          </div>
          <Badge color={present === rosterStudents.length ? "green" : "amber"}>
            {present} / {rosterStudents.length} present
          </Badge>
        </div>
        <Table aria-label={`${selected.title} roster`}>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="hidden sm:table-cell">Grade</TableHead>
              <TableHead className="w-40">Attendance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rosterStudents.map((student, index) => (
              <TableRow key={student.id} index={index}>
                <TableCell>
                  <span className="font-medium text-foreground">
                    {student.name}
                  </span>
                  <span className="mt-1 block sm:hidden">
                    Grade {student.grade}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {student.grade}
                </TableCell>
                <TableCell>
                  <Choice
                    label={`Attendance for ${student.name}`}
                    value={attendance[`${roster}:${student.id}`] ?? "Unmarked"}
                    options={["Unmarked", "Present", "Absent", "Excused"].map(
                      (value) => ({ value, label: value }),
                    )}
                    onChange={(value) =>
                      setAttendance((current) => ({
                        ...current,
                        [`${roster}:${student.id}`]: value as Attendance,
                      }))
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    );

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 overflow-x-auto">
          <TabsList aria-label="Teacher Friday views">
            <TabItem value="day" label="My day" icon={CalendarDays} />
            <TabItem
              value="workshops"
              label="All workshops"
              icon={Presentation}
            />
          </TabsList>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dateControl}
          <Button
            variant="tertiary"
            leadingIcon={Download}
            onClick={() => exportCalendar(workshops, date)}
          >
            Export calendar
          </Button>
        </div>
      </div>
      <TabPanel value="day" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">Sarah Chen</span>
          <span className="text-muted-foreground">
            {workshops.length} sessions ·{" "}
            {workshops.reduce((sum, item) => sum + item.booked, 0)} bookings
          </span>
        </div>
        <Table aria-label="My teaching day">
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-44 md:table-cell">Time</TableHead>
              <TableHead>Session</TableHead>
              <TableHead className="hidden sm:table-cell">Booked</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workshops.map((workshop, index) => (
              <TableRow key={workshop.id} index={index}>
                <TableCell className="hidden md:table-cell">
                  <SessionTime workshop={workshop} />
                </TableCell>
                <TableCell>
                  <WorkshopName workshop={workshop} />
                  <span className="mt-1 block sm:hidden">
                    {workshop.booked} / {workshop.capacity} booked
                  </span>
                </TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">
                  <span className="font-medium text-foreground">
                    {workshop.booked}
                  </span>{" "}
                  / {workshop.capacity}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="tertiary"
                    trailingIcon={ArrowRight}
                    aria-label={`Open roster for ${workshop.title}`}
                    ref={(node) => {
                      if (node) openers.current.set(workshop.id, node);
                      else openers.current.delete(workshop.id);
                    }}
                    onClick={() => {
                      setRoster(workshop.id);
                      requestAnimationFrame(() =>
                        rosterHeading.current?.focus(),
                      );
                    }}
                  >
                    Roster
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-foreground">
              Tutoring availability
            </h2>
            <p className="text-sm text-muted-foreground">Blocks 1 & 2 · B214</p>
          </div>
          {requestStatus && requestStatus !== "Declined" ? (
            <Badge color="amber">
              {requestStatus === "Approved"
                ? "Time away approved"
                : "Request pending"}
            </Badge>
          ) : (
            <AvailabilityRequest
              bookings={workshops
                .filter((item) => item.block === 1 || item.block === 2)
                .reduce((sum, item) => sum + item.booked, 0)}
              onRequest={onRequest}
            />
          )}
        </div>
      </TabPanel>
      <TabPanel value="workshops">
        <WorkshopDirectory workshops={allWorkshops} />
      </TabPanel>
    </Tabs>
  );
}

function AvailabilityRequest({
  bookings,
  onRequest,
}: {
  bookings: number;
  onRequest: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="tertiary">Request time away</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request time away</DialogTitle>
          <DialogDescription>
            Blocks 1 & 2 · {bookings} bookings. Sessions stay open until an
            admin approves the request.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onRequest(reason.trim());
            setOpen(false);
          }}
          className="space-y-3"
        >
          <label htmlFor="availability-reason" className="text-sm font-medium">
            Reason
          </label>
          <Textarea
            id="availability-reason"
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="School duty, appointment…"
            maxLength={500}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!reason.trim()}>
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
