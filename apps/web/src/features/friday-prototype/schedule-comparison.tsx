"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ScheduleComparisonPrototype({ name }: { name: string }) {
  const rows = [
    {
      period: 1,
      mine: "AP Calculus AB",
      theirs: "AP Calculus AB",
      room: "B214",
    },
    { period: 2, mine: "AP Chemistry", theirs: "AP Literature", room: "A108" },
    { period: 3, mine: "US History", theirs: "US History", room: "C110" },
    {
      period: 4,
      mine: "Computer science",
      theirs: "Engineering",
      room: "B106",
    },
  ];
  return (
    <AppShell
      headerSlot={
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Schedule</h1>
          <div className="hidden sm:block">
            <Badge color="amber">Prototype</Badge>
          </div>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <Button asChild variant="ghost" leadingIcon={ArrowLeft}>
          <Link href="/clubs?tab=friends">Friends</Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">With {name}</h2>
          <Badge color="green">2 shared classes</Badge>
        </div>
        <Table aria-label="Schedule comparison">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Period</TableHead>
              <TableHead>You</TableHead>
              <TableHead>{name.split(" ")[0]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, index) => (
              <TableRow key={item.period} index={index}>
                <TableCell>{item.period}</TableCell>
                <TableCell>
                  <span className="font-medium text-foreground">
                    {item.mine}
                  </span>
                  <span className="mt-1 block">{item.room}</span>
                </TableCell>
                <TableCell>
                  {item.mine === item.theirs ? (
                    <>
                      <span className="font-medium text-foreground">
                        {item.theirs}
                      </span>
                      <span className="mt-1 block">Same class</span>
                    </>
                  ) : (
                    item.theirs
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
