"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { timeRange, type Workshop } from "./sample-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} />
      <SelectContent>
        {options.map((option, index) => (
          <SelectItem key={option.value} value={option.value} index={index}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SessionTime({ workshop }: { workshop: Workshop }) {
  return (
    <div className="space-y-1">
      <span className="whitespace-nowrap tabular-nums text-foreground">
        {timeRange(workshop)}
      </span>
      <span className="block">Block {workshop.block}</span>
    </div>
  );
}

export function WorkshopName({
  workshop,
  showTeacher = false,
}: {
  workshop: Workshop;
  showTeacher?: boolean;
}) {
  return (
    <div className="space-y-1">
      <span className="block font-medium text-foreground">
        {workshop.title}
      </span>
      <span className="block">
        {showTeacher ? `${workshop.teacher} · ` : ""}
        {workshop.room}
        <span className="md:hidden"> · {timeRange(workshop)}</span>
      </span>
    </div>
  );
}

export function exportCalendar(items: Workshop[], date: string) {
  const stamp = (minutes: number) =>
    `${date.replaceAll("-", "")}T${String(Math.floor(minutes / 60)).padStart(2, "0")}${String(minutes % 60).padStart(2, "0")}00`;
  const events = items.map((item) =>
    [
      "BEGIN:VEVENT",
      `UID:prototype-${date}-${item.id}@ia.local`,
      "DTSTAMP:20261021T120000Z",
      `DTSTART;TZID=America/New_York:${stamp(item.start)}`,
      `DTEND;TZID=America/New_York:${stamp(item.end)}`,
      `SUMMARY:${item.title}`,
      `LOCATION:${item.room}`,
      "END:VEVENT",
    ].join("\r\n"),
  );
  const url = URL.createObjectURL(
    new Blob(
      [
        [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//IA App//Friday prototype//EN",
          ...events,
          "END:VCALENDAR",
        ].join("\r\n"),
      ],
      { type: "text/calendar" },
    ),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `friday-${date}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function WorkshopDirectory({ workshops }: { workshops: Workshop[] }) {
  return (
    <Table aria-label="All workshops">
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          <TableHead className="hidden md:table-cell">Time</TableHead>
          <TableHead className="text-right">Booked</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workshops.map((item, index) => (
          <TableRow key={item.id} index={index}>
            <TableCell>
              <WorkshopName workshop={item} showTeacher />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <SessionTime workshop={item} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <span className="font-medium text-foreground">{item.booked}</span>{" "}
              / {item.capacity}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
