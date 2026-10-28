"use client";
import { useState, type ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabItem, TabPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkshopDirectory } from "./workshop-table";
import { type Workshop, type AvailabilityRequest } from "./sample-data";
const bulkCandidates: Workshop[] = [
  {
    id: "bulk-harris",
    title: "Physics",
    teacher: "Jordan Harris",
    subject: "Science",
    room: "A112",
    block: 2,
    start: 570,
    end: 620,
    capacity: 16,
    booked: 0,
    kind: "Tutoring",
  },
  {
    id: "bulk-wright",
    title: "World history",
    teacher: "Elena Wright",
    subject: "Social studies",
    room: "C110",
    block: 2,
    start: 570,
    end: 620,
    capacity: 16,
    booked: 0,
    kind: "Tutoring",
  },
  {
    id: "bulk-scott",
    title: "Biology",
    teacher: "Marcus Scott",
    subject: "Science",
    room: "A204",
    block: 2,
    start: 570,
    end: 620,
    capacity: 16,
    booked: 0,
    kind: "Tutoring",
  },
];

export function AdminDay({
  dateControl,
  workshops,
  requests,
  onDecision,
  onCreate,
}: {
  workshops: Workshop[];
  dateControl: ReactNode;
  requests: AvailabilityRequest[];
  onDecision: (teacher: string, status: "Approved" | "Declined") => void;
  onCreate: (items: Workshop[]) => void;
}) {
  const [tab, setTab] = useState("schedule");
  const [bulk, setBulk] = useState(false);
  const candidates = bulkCandidates.filter(
    (candidate) =>
      !workshops.some((item) => item.id === candidate.id) &&
      !requests.some(
        (request) =>
          request.teacher === candidate.teacher &&
          request.status !== "Declined" &&
          request.blocks.includes(candidate.block),
      ),
  );
  const pending = requests.filter((item) => item.status === "Pending");
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(value);
        setBulk(false);
      }}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 overflow-x-auto">
          <TabsList aria-label="Admin Friday views">
            <TabItem value="schedule" label="Schedule" />
            <TabItem value="teachers" label="Teachers" />
            <TabItem
              value="requests"
              label={`Requests${pending.length ? ` (${pending.length})` : ""}`}
            />
          </TabsList>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dateControl}
          {tab !== "requests" ? (
            <Button
              leadingIcon={Plus}
              onClick={() => {
                setBulk(true);
                setTab("teachers");
              }}
              disabled={candidates.length === 0}
            >
              Create tutoring
            </Button>
          ) : null}
        </div>
      </div>
      <TabPanel value="schedule" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">
            4 blocks · {workshops.length} sessions
          </span>
          <Badge
            color={
              workshops.some((item) => item.bookingPaused) ? "amber" : "green"
            }
          >
            {workshops.some((item) => item.bookingPaused)
              ? "Coverage needed"
              : "Bookings open"}
          </Badge>
        </div>
        <WorkshopDirectory workshops={workshops} />
      </TabPanel>
      <TabPanel value="teachers" className="space-y-4">
        {bulk ? (
          <section className="space-y-4" aria-labelledby="bulk-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2
                  id="bulk-heading"
                  className="text-lg font-semibold text-foreground"
                >
                  Create tutoring · Block 2
                </h2>
                <p className="text-sm text-muted-foreground">
                  9:30–10:20 AM · 16 places per session
                </p>
              </div>
              <Button variant="ghost" onClick={() => setBulk(false)}>
                Cancel
              </Button>
            </div>
            <Table aria-label="Tutoring creation preview">
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Subject
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((item, index) => (
                  <TableRow key={item.id} index={index}>
                    <TableCell>
                      <span className="font-medium text-foreground">
                        {item.teacher}
                      </span>
                      <span className="mt-1 block sm:hidden">
                        {item.subject}
                      </span>
                    </TableCell>
                    <TableCell>{item.room}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {item.subject}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Existing sessions and unavailable teachers are skipped.
              </p>
              <Button
                disabled={!candidates.length}
                leadingIcon={Check}
                onClick={() => {
                  onCreate(candidates);
                  setBulk(false);
                }}
              >
                Create {candidates.length} sessions
              </Button>
            </div>
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">
                Teacher coverage
              </span>
              <span className="text-muted-foreground">
                Block 2 · 9:30–10:20 AM
              </span>
            </div>
            <Table aria-label="Teacher coverage">
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead className="hidden sm:table-cell">Room</TableHead>
                  <TableHead>Block 2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ...new Map(
                    [...workshops, ...bulkCandidates].map((item) => [
                      item.teacher,
                      item,
                    ]),
                  ).values(),
                ].map((item, index) => {
                  const session = workshops.find(
                    (workshop) =>
                      workshop.teacher === item.teacher && workshop.block === 2,
                  );
                  const request = requests.find(
                    (request) =>
                      request.teacher === item.teacher &&
                      request.status !== "Declined" &&
                      request.blocks.includes(2),
                  );
                  return (
                    <TableRow key={item.teacher} index={index}>
                      <TableCell>
                        <span className="font-medium text-foreground">
                          {item.teacher}
                        </span>
                        <span className="mt-1 block sm:hidden">
                          {item.room}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {item.room}
                      </TableCell>
                      <TableCell>
                        {request ? (
                          <Badge color="amber">
                            {request.status === "Approved"
                              ? "Needs coverage"
                              : "Request pending"}
                          </Badge>
                        ) : session ? (
                          <span className="text-foreground">
                            {session.title}
                          </span>
                        ) : (
                          <span>Not scheduled</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </TabPanel>
      <TabPanel value="requests" className="space-y-4">
        {requests.map((request) => (
          <div
            key={request.teacher}
            className="flex flex-wrap items-start justify-between gap-4 border-b border-border/40 pb-5"
          >
            <div className="space-y-2">
              <h2 className="font-semibold text-foreground">
                {request.teacher}
              </h2>
              <p className="text-sm text-muted-foreground">
                Blocks {request.blocks.join(" & ")} · {request.reason}
              </p>
              <p className="text-sm text-foreground">
                {workshops
                  .filter(
                    (item) =>
                      item.teacher === request.teacher &&
                      request.blocks.includes(item.block),
                  )
                  .reduce((sum, item) => sum + item.booked, 0)}{" "}
                bookings affected
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {request.status === "Pending" ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => onDecision(request.teacher, "Declined")}
                  >
                    Decline
                  </Button>
                  <Button
                    variant="tertiary"
                    onClick={() => onDecision(request.teacher, "Approved")}
                  >
                    Approve absence
                  </Button>
                </>
              ) : (
                <Badge color={request.status === "Approved" ? "green" : "gray"}>
                  {request.status}
                </Badge>
              )}
            </div>
            {request.status === "Approved" ? (
              <p className="w-full text-sm text-muted-foreground">
                New bookings are paused. Coverage is still needed for the
                existing bookings.
              </p>
            ) : null}
          </div>
        ))}
      </TabPanel>
    </Tabs>
  );
}
