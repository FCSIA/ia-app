// Fictional, browser-local data for the design review. No Convex mutations.
export type PreviewRole = "teacher" | "student" | "admin";
export type Attendance = "Unmarked" | "Present" | "Absent" | "Excused";
export type Workshop = {
  id: string;
  title: string;
  teacher: string;
  subject: string;
  room: string;
  block: number;
  start: number;
  end: number;
  capacity: number;
  booked: number;
  kind: "Tutoring" | "Workshop";
  bookingPaused?: boolean;
};

export const fridays = [
  { value: "2026-10-23", label: "Fri, Oct 23" },
  { value: "2026-11-06", label: "Fri, Nov 6" },
  { value: "2026-11-20", label: "Fri, Nov 20" },
];

export const workshops: Workshop[] = [
  {
    id: "chen-1",
    title: "Algebra & precalculus",
    teacher: "Sarah Chen",
    subject: "Mathematics",
    room: "B214",
    block: 1,
    start: 510,
    end: 560,
    capacity: 16,
    booked: 12,
    kind: "Tutoring",
  },
  {
    id: "patel-1",
    title: "Chemistry",
    teacher: "Maya Patel",
    subject: "Science",
    room: "A108",
    block: 1,
    start: 510,
    end: 560,
    capacity: 12,
    booked: 12,
    kind: "Tutoring",
  },
  {
    id: "chen-2",
    title: "Calculus",
    teacher: "Sarah Chen",
    subject: "Mathematics",
    room: "B214",
    block: 2,
    start: 570,
    end: 620,
    capacity: 16,
    booked: 9,
    kind: "Tutoring",
  },
  {
    id: "rivera-2",
    title: "Writing lab",
    teacher: "Daniel Rivera",
    subject: "English",
    room: "C203",
    block: 2,
    start: 570,
    end: 620,
    capacity: 20,
    booked: 6,
    kind: "Tutoring",
  },
  {
    id: "chen-3",
    title: "Math competition practice",
    teacher: "Sarah Chen",
    subject: "Mathematics",
    room: "B214",
    block: 3,
    start: 630,
    end: 680,
    capacity: 24,
    booked: 18,
    kind: "Workshop",
  },
  {
    id: "robotics",
    title: "Robotics open lab",
    teacher: "James Morgan",
    subject: "Engineering",
    room: "Maker space",
    block: 3,
    start: 630,
    end: 680,
    capacity: 24,
    booked: 19,
    kind: "Workshop",
  },
  {
    id: "studio",
    title: "Portfolio studio",
    teacher: "Avery Brooks",
    subject: "Art",
    room: "D110",
    block: 4,
    start: 750,
    end: 800,
    capacity: 20,
    booked: 14,
    kind: "Workshop",
  },
  {
    id: "liu-4",
    title: "Computer science",
    teacher: "Grace Liu",
    subject: "Technology",
    room: "B106",
    block: 4,
    start: 750,
    end: 800,
    capacity: 16,
    booked: 7,
    kind: "Tutoring",
  },
];

export const students = [
  { id: "a", name: "Aiden Parker", grade: 11 },
  { id: "b", name: "Amelia Williams", grade: 10 },
  { id: "c", name: "Ethan Davis", grade: 11 },
  { id: "d", name: "Isabella Martinez", grade: 12 },
  { id: "e", name: "Liam Wilson", grade: 10 },
  { id: "f", name: "Mia Anderson", grade: 11 },
  { id: "g", name: "Noah Thomas", grade: 12 },
  { id: "h", name: "Olivia Taylor", grade: 10 },
  { id: "i", name: "Sofia Robinson", grade: 11 },
  { id: "j", name: "William Lee", grade: 12 },
  { id: "k", name: "Zoe Clark", grade: 10 },
  { id: "l", name: "Lucas Lewis", grade: 11 },
  { id: "m", name: "Chloe Walker", grade: 12 },
  { id: "n", name: "Benjamin Hall", grade: 10 },
  { id: "o", name: "Harper Young", grade: 11 },
  { id: "p", name: "Elijah Allen", grade: 12 },
  { id: "q", name: "Charlotte King", grade: 11 },
  { id: "r", name: "Henry Wright", grade: 10 },
];

export function clock(minutes: number) {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeRange(workshop: Pick<Workshop, "start" | "end">) {
  return `${clock(workshop.start)}–${clock(workshop.end)} ${workshop.end < 720 ? "AM" : "PM"}`;
}

export function overlaps(a: Workshop, b: Workshop) {
  return a.start < b.end && b.start < a.end;
}

export type AvailabilityRequest = {
  teacher: string;
  reason: string;
  blocks: number[];
  status: "Pending" | "Approved" | "Declined";
};
