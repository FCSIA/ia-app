"use client";
import { useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Choice } from "./workshop-table";
import { TeacherDay } from "./teacher-day";
import { StudentDay } from "./student-day";
import { AdminDay } from "./admin-day";
import {
  fridays,
  overlaps,
  workshops as initialWorkshops,
  type PreviewRole,
  type AvailabilityRequest,
  type Attendance,
  type Workshop,
} from "./sample-data";
export function FridayPrototype() {
  const params = useSearchParams();
  const roleParam = params?.get("view");
  const role: PreviewRole =
    roleParam === "student" || roleParam === "admin" ? roleParam : "teacher";
  const [date, setDate] = useState(fridays[0].value);
  const router = useRouter();
  const roleControl = (
    <div className="w-40 shrink-0">
      <Choice
        label="Prototype role"
        value={role}
        options={[
          { value: "teacher", label: "Teacher preview" },
          { value: "student", label: "Student preview" },
          { value: "admin", label: "Admin preview" },
        ]}
        onChange={(value) => router.replace(`/flex-friday?view=${value}`)}
      />
    </div>
  );
  return (
    <AppShell
      headerSlot={
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            Flex Friday
          </h1>
          <div className="hidden sm:block">{roleControl}</div>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="flex items-center justify-between gap-3 sm:hidden">
          <span className="text-sm text-muted-foreground">Preview role</span>
          {roleControl}
        </div>
        <FridayDay
          key={date}
          role={role}
          date={date}
          dateControl={
            <div className="w-40">
              <Choice
                label="Friday"
                value={date}
                options={fridays}
                onChange={setDate}
              />
            </div>
          }
        />
      </div>
    </AppShell>
  );
}

function FridayDay({
  role,
  date,
  dateControl,
}: {
  role: PreviewRole;
  date: string;
  dateControl: ReactNode;
}) {
  const [workshops, setWorkshops] = useState(initialWorkshops);
  const [bookings, setBookings] = useState(["robotics", "studio"]);
  const [notice, updateNotice] = useState<{
    role: PreviewRole;
    message: string;
  } | null>(null);
  const setNotice = (message: string) => updateNotice({ role, message });
  const [requests, setRequests] = useState<AvailabilityRequest[]>([
    {
      teacher: "Maya Patel",
      reason: "School trip",
      blocks: [1, 2],
      status: "Pending",
    },
  ]);
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const visibleWorkshops = [...workshops]
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))
    .map((item) => ({
      ...item,
      bookingPaused: requests.some(
        (request) =>
          request.status === "Approved" &&
          request.teacher === item.teacher &&
          request.blocks.includes(item.block),
      ),
    }));
  const teacherWorkshops = visibleWorkshops.filter(
    (item) => item.teacher === "Sarah Chen",
  );
  const bookedWorkshops = workshops.filter((item) =>
    bookings.includes(item.id),
  );

  function book(workshop: Workshop) {
    if (
      workshop.bookingPaused ||
      bookings.includes(workshop.id) ||
      workshop.booked >= workshop.capacity
    )
      return;
    if (bookedWorkshops.some((item) => overlaps(item, workshop))) {
      setNotice(
        "You already have a booking at this time. Cancel it first to change sessions.",
      );
      return;
    }
    setBookings((current) => [...current, workshop.id]);
    setWorkshops((current) =>
      current.map((item) =>
        item.id === workshop.id ? { ...item, booked: item.booked + 1 } : item,
      ),
    );
    setNotice(`Booked ${workshop.title}. Your Friday pass is updated.`);
  }

  function cancel(id: string) {
    setBookings((current) => current.filter((item) => item !== id));
    setWorkshops((current) =>
      current.map((item) =>
        item.id === id ? { ...item, booked: item.booked - 1 } : item,
      ),
    );
    setNotice("Booking canceled. The place is available again.");
  }

  return (
    <>
      {role === "teacher" ? (
        <TeacherDay
          workshops={teacherWorkshops}
          allWorkshops={visibleWorkshops}
          date={date}
          dateControl={dateControl}
          requestStatus={
            requests.find((item) => item.teacher === "Sarah Chen")?.status
          }
          studentBookings={bookings}
          attendance={attendance}
          setAttendance={setAttendance}
          onRequest={(reason) => {
            setRequests((current) => [
              ...current.filter((item) => item.teacher !== "Sarah Chen"),
              {
                teacher: "Sarah Chen",
                reason,
                blocks: [1, 2],
                status: "Pending",
              },
            ]);
            setNotice(
              "Availability request sent for review. Your sessions remain open until it is approved.",
            );
          }}
        />
      ) : null}
      {role === "student" ? (
        <StudentDay
          workshops={visibleWorkshops}
          bookings={bookings}
          book={book}
          cancel={cancel}
          date={date}
          dateControl={dateControl}
        />
      ) : null}
      {role === "admin" ? (
        <AdminDay
          dateControl={dateControl}
          workshops={visibleWorkshops}
          requests={requests}
          onDecision={(teacher, status) => {
            setRequests((current) =>
              current.map((item) =>
                item.teacher === teacher ? { ...item, status } : item,
              ),
            );
            setNotice(`${teacher}’s request ${status.toLowerCase()}.`);
          }}
          onCreate={(items) => {
            setWorkshops((current) => [...current, ...items]);
            setNotice(
              `${items.length} tutoring sessions created in this prototype.`,
            );
          }}
        />
      ) : null}
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {notice?.role === role ? notice.message : ""}
      </p>
    </>
  );
}
