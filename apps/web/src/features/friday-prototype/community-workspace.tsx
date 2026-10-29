"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  UsersRound,
  UserRound,
  Shapes,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardGroup,
  CardHeader,
  CardTitle,
  CardDescription,
  CardMedia,
} from "@/components/ui/card";
import { Tabs, TabsList, TabItem, TabPanel } from "@/components/ui/tabs";

const clubs = [
  {
    name: "Robotics Club",
    topic: "Engineering",
    detail: "Build team · Fridays in the Maker space",
    members: 42,
  },
  {
    name: "Student Council",
    topic: "Leadership",
    detail: "School events · Wednesdays in C101",
    members: 28,
  },
  {
    name: "Math Team",
    topic: "Mathematics",
    detail: "Competition practice · Tuesdays in B214",
    members: 34,
  },
];
const initialFriends = ["Amelia Williams", "Ethan Davis", "Mia Anderson"];
const initialRequests = ["Noah Thomas", "Olivia Taylor"];

export function CommunityPrototype() {
  const params = useSearchParams();
  const [tab, setTab] = useState(
    params?.get("tab") === "friends" ? "friends" : "clubs",
  );
  const [friends, setFriends] = useState(initialFriends);
  const [requests, setRequests] = useState(initialRequests);
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const clubTitle = useRef<HTMLHeadingElement>(null);
  const clubCards = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (selectedClub) clubTitle.current?.focus();
  }, [selectedClub]);
  return (
    <AppShell
      headerSlot={
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
            Community
          </h1>
          <div className="hidden sm:block">
            <Badge color="amber">Prototype</Badge>
          </div>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setSelectedClub(null);
          }}
          className="space-y-5"
        >
          <div className="min-w-0 overflow-x-auto">
            <TabsList aria-label="Community views">
              <TabItem value="clubs" label="Clubs" icon={Shapes} />
              <TabItem value="friends" label="Friends" icon={UserRound} />
            </TabsList>
          </div>
          <TabPanel value="clubs" className="space-y-4">
            {selectedClub ? (
              <section className="space-y-5">
                <Button
                  variant="ghost"
                  leadingIcon={ArrowLeft}
                  onClick={() => {
                    setSelectedClub(null);
                    requestAnimationFrame(() =>
                      clubCards.current
                        .get(selectedClub)
                        ?.querySelector<HTMLButtonElement>("button")
                        ?.focus(),
                    );
                  }}
                >
                  My clubs
                </Button>
                <div className="space-y-1">
                  <h2
                    ref={clubTitle}
                    tabIndex={-1}
                    className="text-xl font-semibold"
                  >
                    {selectedClub}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {clubs.find((club) => club.name === selectedClub)?.detail}
                  </p>
                </div>
                <div className="border-t border-border/40 pt-4">
                  <h3 className="mb-3 text-sm font-medium">Announcements</h3>
                  <p className="text-sm text-foreground">
                    Friday’s meeting is in our usual room. Bring your project
                    notes.
                  </p>
                </div>
              </section>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <h2 className="font-medium text-foreground">My clubs</h2>
                  <span className="text-muted-foreground">
                    {clubs.length} memberships
                  </span>
                </div>
                <CardGroup orientation="inline">
                  {clubs.map((club) => (
                    <Card
                      key={club.name}
                      ref={(node) => {
                        if (node) clubCards.current.set(club.name, node);
                        else clubCards.current.delete(club.name);
                      }}
                      onClick={() => setSelectedClub(club.name)}
                      label={`Open ${club.name}`}
                    >
                      <CardMedia icon={UsersRound} />
                      <CardHeader>
                        <CardTitle>{club.name}</CardTitle>
                        <CardDescription>{club.detail}</CardDescription>
                      </CardHeader>
                      <span className="hidden shrink-0 text-sm tabular-nums text-muted-foreground sm:block">
                        {club.members} members
                      </span>
                    </Card>
                  ))}
                </CardGroup>
              </>
            )}
          </TabPanel>
          <TabPanel value="friends" className="space-y-6">
            {requests.length ? (
              <section className="space-y-3" aria-labelledby="friend-requests">
                <h2 id="friend-requests" className="text-sm font-medium">
                  Requests{" "}
                  <span className="ml-2 text-muted-foreground">
                    {requests.length}
                  </span>
                </h2>
                <div className="divide-y divide-border/40">
                  {requests.map((name) => (
                    <div
                      key={name}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <span className="text-sm font-medium text-foreground">
                        {name}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setRequests((current) =>
                              current.filter((item) => item !== name),
                            );
                            setNotice(`Declined ${name}’s request.`);
                          }}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="secondary"
                          leadingIcon={Check}
                          onClick={() => {
                            setFriends((current) => [...current, name]);
                            setRequests((current) =>
                              current.filter((item) => item !== name),
                            );
                            setNotice(`${name} added to friends.`);
                          }}
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="space-y-3" aria-labelledby="friends-heading">
              <h2 id="friends-heading" className="text-sm font-medium">
                Friends{" "}
                <span className="ml-2 text-muted-foreground">
                  {friends.length}
                </span>
              </h2>
              <CardGroup orientation="inline">
                {friends.map((name) => (
                  <Card
                    key={name}
                    href={`/schedule?prototypeFriend=${encodeURIComponent(name)}`}
                    label={`Compare schedules with ${name}`}
                  >
                    <CardHeader>
                      <CardTitle>{name}</CardTitle>
                      <CardDescription>Compare schedules</CardDescription>
                    </CardHeader>
                    <ArrowRight
                      size={16}
                      aria-hidden="true"
                      className="shrink-0 text-muted-foreground"
                    />
                  </Card>
                ))}
              </CardGroup>
            </section>
          </TabPanel>
        </Tabs>
        <p role="status" className="min-h-5 text-sm text-muted-foreground">
          {notice}
        </p>
      </div>
    </AppShell>
  );
}
