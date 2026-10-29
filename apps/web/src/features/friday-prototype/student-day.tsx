"use client";
import { useState, type ReactNode } from "react";
import { Download } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabItem, TabPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Choice,
  SessionTime,
  WorkshopName,
  exportCalendar,
} from "./workshop-table";
import { fridays, overlaps, timeRange, type Workshop } from "./sample-data";
export function StudentDay({
  workshops,
  bookings,
  book,
  cancel,
  date,
  dateControl,
}: {
  workshops: Workshop[];
  bookings: string[];
  book: (item: Workshop) => void;
  cancel: (id: string) => void;
  date: string;
  dateControl: ReactNode;
}) {
  const [tab, setTab] = useState("day");
  const [subject, setSubject] = useState("all");
  const [blockFilter, setBlockFilter] = useState("all");
  const [pass, setPass] = useState<Workshop | null>(null);
  const mine = workshops.filter((item) => bookings.includes(item.id));
  const displayed = workshops.filter(
    (item) =>
      item.kind === (tab === "tutoring" ? "Tutoring" : "Workshop") &&
      (subject === "all" || item.subject === subject) &&
      (blockFilter === "all" || item.block === Number(blockFilter)),
  );
  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setSubject("all");
          setBlockFilter("all");
        }}
        className="space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 overflow-x-auto">
            <TabsList aria-label="Student Friday views">
              <TabItem value="day" label="My Friday" />
              <TabItem value="tutoring" label="Tutoring" />
              <TabItem value="workshops" label="Workshops" />
            </TabsList>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dateControl}
            {tab === "day" ? (
              <Button
                variant="tertiary"
                leadingIcon={Download}
                onClick={() => exportCalendar(mine, date)}
              >
                Export calendar
              </Button>
            ) : null}
          </div>
        </div>
        <TabPanel value="day" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-foreground">Alex Johnson</span>
            <Badge color={mine.length === 4 ? "green" : "amber"}>
              {mine.length} of 4 blocks booked
            </Badge>
          </div>
          <Table aria-label="My Friday bookings">
            <TableHeader>
              <TableRow>
                <TableHead className="hidden w-44 md:table-cell">
                  Time
                </TableHead>
                <TableHead>Session</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4].map((block, index) => {
                const item = mine.find((workshop) => workshop.block === block);
                const slot = workshops.find(
                  (workshop) => workshop.block === block,
                )!;
                return (
                  <TableRow key={block} index={index}>
                    <TableCell className="hidden md:table-cell">
                      <SessionTime workshop={slot} />
                    </TableCell>
                    <TableCell>
                      {item ? (
                        <WorkshopName workshop={item} showTeacher />
                      ) : (
                        <div className="space-y-1">
                          <span className="block font-medium text-foreground">
                            Choose a session
                          </span>
                          <span className="block md:hidden">
                            Block {block}
                            <span className="md:hidden">
                              {" "}
                              · {timeRange(slot)}
                            </span>
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="ghost"
                            onClick={() => cancel(item.id)}
                            aria-label={`Cancel ${item.title}`}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="tertiary"
                            onClick={() => setPass(item)}
                            aria-label={`Show pass for ${item.title}`}
                          >
                            Pass
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setSubject("all");
                            setBlockFilter(String(block));
                            setTab("tutoring");
                          }}
                        >
                          Find tutoring
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabPanel>
        {["tutoring", "workshops"].map((value) => (
          <TabPanel key={value} value={value} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid w-full grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:w-auto sm:grid-cols-[10rem_12rem]">
                <Choice
                  label="Block"
                  value={blockFilter}
                  onChange={setBlockFilter}
                  options={[
                    { value: "all", label: "All blocks" },
                    ...[1, 2, 3, 4].map((block) => ({
                      value: String(block),
                      label: `Block ${block}`,
                    })),
                  ]}
                />
                <Choice
                  label="Subject"
                  value={subject}
                  options={[
                    { value: "all", label: "All subjects" },
                    ...Array.from(
                      new Set(
                        workshops
                          .filter(
                            (item) =>
                              item.kind ===
                              (value === "tutoring" ? "Tutoring" : "Workshop"),
                          )
                          .map((item) => item.subject),
                      ),
                    ).map((item) => ({ value: item, label: item })),
                  ]}
                  onChange={setSubject}
                />
              </div>
              <span className="sr-only" role="status">
                {displayed.length} sessions
              </span>
            </div>
            <Table aria-label={`Available ${value}`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead className="hidden md:table-cell">Time</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Places left
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Booking</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((item, index) => {
                  const booked = bookings.includes(item.id);
                  const full = item.booked >= item.capacity;
                  const conflict =
                    !booked && mine.some((other) => overlaps(item, other));
                  return (
                    <TableRow key={item.id} index={index}>
                      <TableCell>
                        <WorkshopName workshop={item} showTeacher />
                        <span className="mt-1 block sm:hidden">
                          {item.capacity - item.booked} places left
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <SessionTime workshop={item} />
                      </TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">
                        <span className="font-medium text-foreground">
                          {item.capacity - item.booked}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {booked ? (
                          <Badge color="green">Booked</Badge>
                        ) : item.bookingPaused ? (
                          <Badge color="amber">Paused</Badge>
                        ) : full ? (
                          <Badge color="gray">Full</Badge>
                        ) : conflict ? (
                          <Badge color="amber">Time conflict</Badge>
                        ) : (
                          <Button
                            onClick={() => book(item)}
                            aria-label={`Book ${item.title}`}
                          >
                            Book
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {displayed.length === 0 ? (
                  <TableRow index={0}>
                    <TableCell colSpan={4}>
                      No sessions match these filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TabPanel>
        ))}
      </Tabs>
      <Dialog
        open={!!pass}
        onOpenChange={(open) => {
          if (!open) setPass(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Friday pass</DialogTitle>
            <DialogDescription>
              {fridays.find((item) => item.value === date)?.label} · Alex
              Johnson
            </DialogDescription>
          </DialogHeader>
          {pass ? (
            <div className="space-y-4">
              <Badge color="green">Booking confirmed</Badge>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">
                  {pass.title}
                </h2>
                <p className="text-sm text-muted-foreground">{pass.teacher}</p>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Room</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {pass.room}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Time</dt>
                  <dd className="mt-1 text-foreground">{timeRange(pass)}</dd>
                </div>
              </dl>
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
