"use client";

import { useState } from "react";
import { format, startOfDay } from "date-fns";
import { api } from "~/apps/convex/src/_generated/api";
import { useQuery } from "@/lib/convex-react";
import { Panel } from "@/components/layout/page-frame";
import {
  Card,
  CardGroup,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { formatSchoolTime } from "@/lib/time-format";
import { useCurrentUser } from "@/lib/auth";
import { calendarDate } from "@/components/calendar/calendar-date";
import { schoolDateKey } from "@/lib/school-date";
import { workshopDetailHref } from "@/app/flex-friday/_utils";

export function FlexFridaySnapshotWidget() {
  const [from] = useState(() => startOfDay(calendarDate()).getTime());
  const data = useQuery(api.dashboard.flexFriday.snapshot, { from });
  const user = useCurrentUser();
  return (
    <Panel
      title="Flex Friday"
      href="/flex-friday"
      loading={data === undefined}
      loadingRows={1}
      flush
    >
      {data?.workshops.length ? (
        <CardGroup orientation="inline" corners="panel">
          {data.workshops.map((workshop) => (
            <Card
              key={workshop.id}
              href={!data.student && schoolDateKey(new Date(data.date)) === schoolDateKey()
                ? `/flex-friday?friday=${data.fridayId}&session=${workshop.sessionId}&attendance=${workshop.id}`
                : workshopDetailHref(data.fridayId, workshop.id, workshop.sessionId)}
              label={`Open ${workshop.title}`}
            >
              <CardHeader>
                <CardTitle>{workshop.title}</CardTitle>
                <CardDescription>
                  {format(calendarDate(data.date), "EEE, MMM d")} ·{" "}
                  {formatSchoolTime(workshop.startTime, user?.use24HourTime)}
                  {workshop.location ? ` · ${workshop.location}` : ""}
                  {!data.student
                    ? ` · ${workshop.registered}${workshop.hasMoreRegistrations ? "+" : ""} registered`
                    : ""}
                  {!data.student &&
                  schoolDateKey(new Date(data.date)) === schoolDateKey()
                    ? " · Take attendance"
                    : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </CardGroup>
      ) : (
        <Empty size="inline">
          <EmptyDescription>
            {!data
              ? "No upcoming Flex Friday."
              : data.hasMore
                ? "Open Flex Friday to see all workshops."
                : data.student
                  ? "No workshop selected for the next Flex Friday."
                  : "You are not hosting a workshop on the next Flex Friday."}
          </EmptyDescription>
        </Empty>
      )}
    </Panel>
  );
}
