"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BellRing, Pause, Play, Trophy } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import { useMutation, useQuery } from "@/lib/convex-react";
import { Panel } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/lib/auth";
import { spring } from "@/lib/springs";
import { formatClockTime } from "~/apps/shared/school-time";
import { cn } from "@/lib/utils";
import styles from "./snake-widget.module.css";
import { SnakeBody } from "./SnakeBody";
import { useClassLock, type ClassLock } from "./use-class-lock";

type Direction = "up" | "down" | "left" | "right";
type Mode = "small" | "medium" | "large" | "extra-large";
type View = "setup" | "leaderboard" | "game";
type Game = {
  snake: number[];
  food: number;
  direction: Direction;
  status: "ready" | "playing" | "paused" | "over" | "won";
  /** The food eaten on the latest tick; it stays under the head until the glide lands. */
  eaten?: number;
};
const modes: { id: Mode; label: string; width: number; height: number }[] = [
  { id: "small", label: "Small", width: 10, height: 8 },
  { id: "medium", label: "Medium", width: 16, height: 10 },
  { id: "large", label: "Large", width: 20, height: 12 },
  { id: "extra-large", label: "Extra Large", width: 24, height: 16 },
];
const initial = (width: number, height: number): Game => {
  const head = Math.floor(height / 2) * width + Math.floor(width / 2);
  return { snake: [head, head - 1, head - 2], food: head + 3, direction: "right", status: "ready" };
};
// Starts slow, speeds up fastest over the first few foods, then levels off near the floor.
const tickMs = (score: number) => Math.round(80 + 100 * Math.exp(-score / 8));
const opposite: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
const keys: Partial<Record<string, Direction>> = {
  arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right",
  w: "up", s: "down", a: "left", d: "right",
};
const controls = [
  { direction: "up", icon: ArrowUp }, { direction: "left", icon: ArrowLeft },
  { direction: "down", icon: ArrowDown }, { direction: "right", icon: ArrowRight },
] as const;
function SchoolLeaderboard({ mode }: { mode: Mode }) {
  const scores = useQuery(api.dashboard.snake.leaderboard, { mode });
  if (scores === undefined) return <p role="status" className="py-6 text-sm text-muted-foreground">Loading scores…</p>;
  if (scores.length === 0) return (
    <div className="py-5">
      <p className="text-sm text-muted-foreground">No scores yet.</p>
    </div>
  );
  return (
    <Table aria-label="School Snake leaderboard">
      <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Player</TableHead><TableHead className="text-right">Score</TableHead></TableRow></TableHeader>
      <TableBody>{scores.map((entry, index) => (
        <TableRow key={`${entry.name}-${index}`} index={index}>
          <TableCell className="w-12 tabular-nums text-muted-foreground">{index + 1}</TableCell>
          <TableCell><span className="break-words">{entry.name}{entry.isYou ? " (you)" : ""}</span></TableCell>
          <TableCell className="text-right font-medium tabular-nums">{entry.score}</TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  );
}

export function SnakeWidget({ layoutEditing = false }: { layoutEditing?: boolean }) {
  const [mode, setMode] = useState<Mode | "">("");
  const [view, setView] = useState<View>("setup");
  const selected = modes.find(item => item.id === mode);
  const { width, height } = selected ?? modes[1];
  const [game, setGame] = useState<Game>(() => initial(16, 10));
  const [saveError, setSaveError] = useState(false);
  const [keyboardUsed, setKeyboardUsed] = useState(false);
  const turns = useRef<Direction[]>([]);
  const heading = useRef<Direction>("right");
  const board = useRef<HTMLDivElement>(null);
  const modePicker = useRef<HTMLButtonElement>(null);
  const previousView = useRef<View>("setup");
  const leaderboardOrigin = useRef<"setup" | "game">("setup");
  const scoreForSpeed = useRef(0);
  // iOS moves focus off the board when a direction button is tapped, even with
  // pointerdown cancelled. That blur must not read as the player leaving.
  const pressingControl = useRef(false);
  const submit = useMutation(api.dashboard.snake.submit);
  const lock = useClassLock();
  const locked = lock !== null;
  const modeLabelId = useId();
  const instructionsId = useId();
  const score = game.snake.length - 3;
  const finished = game.status === "over" || game.status === "won";
  const steer = (direction: Direction) => {
    // Buffer up to two turns so quick combos (e.g. up-then-left) aren't dropped between ticks.
    const last = turns.current.at(-1) ?? heading.current;
    if (direction === last || direction === opposite[last] || turns.current.length >= 2) return;
    turns.current.push(direction);
  };

  useEffect(() => { scoreForSpeed.current = score; }, [score]);

  // Fixed-step loop on animation frames: steady cadence without setInterval drift,
  // no timer restart when the speed changes, and it idles with the tab.
  useEffect(() => {
    if (game.status !== "playing" || layoutEditing || view !== "game" || locked) return;
    let frame = 0;
    let last = performance.now();
    const step = () => {
      const random = Math.random();
      const turn = turns.current.shift();
      if (turn) heading.current = turn;
      setGame(prev => {
        if (prev.status !== "playing") return prev;
        const requested = turn ?? prev.direction;
        const direction = requested === opposite[prev.direction] ? prev.direction : requested;
        const head = prev.snake[0];
        const x = head % width + (direction === "right" ? 1 : direction === "left" ? -1 : 0);
        const y = Math.floor(head / width) + (direction === "down" ? 1 : direction === "up" ? -1 : 0);
        const target = y * width + x;
        const eating = target === prev.food;
        if (x < 0 || x >= width || y < 0 || y >= height || (eating ? prev.snake : prev.snake.slice(0, -1)).includes(target)) return { ...prev, status: "over" };
        const snake = [target, ...prev.snake.slice(0, eating ? undefined : -1)];
        if (!eating) return { ...prev, snake, direction, eaten: undefined };
        const free = Array.from({ length: width * height }, (_, i) => i).filter(i => !snake.includes(i));
        if (!free.length) return { ...prev, snake, direction, eaten: target, status: "won" };
        return { ...prev, snake, direction, eaten: target, food: free[Math.floor(random * free.length)] };
      });
    };
    const loop = (now: number) => {
      const interval = tickMs(scoreForSpeed.current);
      if (now - last >= interval) {
        // Stay on the grid of ticks, but never replay a backlog after a stall.
        last = now - last >= interval * 2 ? now : last + interval;
        step();
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [game.status, layoutEditing, view, width, height, locked]);

  useEffect(() => {
    if (!finished || score === 0 || !mode) return;
    let active = true;
    void submit({ mode, score }).catch(() => { if (active) setSaveError(true); });
    return () => { active = false; };
  }, [finished, score, mode, submit]);

  useEffect(() => {
    const changedView = previousView.current !== view;
    previousView.current = view;
    if (layoutEditing || locked) return;
    if (view === "game" && (changedView || game.status === "playing")) {
      board.current?.focus({ preventScroll: true });
    } else if (changedView) modePicker.current?.focus({ preventScroll: true });
  }, [view, game.status, layoutEditing, locked]);

  useEffect(() => {
    const pause = () => setGame(prev => prev.status === "playing" ? { ...prev, status: "paused" } : prev);
    const onVisibility = () => { if (document.hidden) pause(); };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (layoutEditing || locked) setGame(prev => prev.status === "playing" ? { ...prev, status: "paused" } : prev);
  }, [layoutEditing, locked]);

  const start = () => {
    if (!mode || layoutEditing) return;
    setSaveError(false);
    if (game.status === "paused") setGame(prev => ({ ...prev, status: "playing" }));
    else {
      turns.current = []; heading.current = "right";
      setGame({ ...initial(width, height), status: "playing" });
    }
    setView("game");
  };
  const showLeaderboard = () => {
    leaderboardOrigin.current = view === "game" ? "game" : "setup";
    if (!mode) setMode("medium");
    if (game.status === "playing") setGame(prev => ({ ...prev, status: "paused" }));
    setView("leaderboard");
  };
  const showSetup = () => {
    setGame(initial(width, height));
    setSaveError(false);
    setView("setup");
  };

  // The checkerboard only changes with board size, so it doesn't re-render on every tick.
  const squares = useMemo(() => Array.from({ length: width * height }, (_, cell) => (
    <span key={cell} aria-hidden className={cn("aspect-square", (Math.floor(cell / width) + cell % width) % 2 === 0 ? styles.lightSquare : styles.darkSquare)} />
  )), [width, height]);

  // Food sits under the snake; new food pops in as the head lands on the old one.
  const foodDelay = game.status === "playing" ? `${tickMs(score)}ms` : "0ms";
  const foodDot = (cell: number, className: string, key: string | number) => (
    <span
      key={key}
      aria-hidden
      className={cn(className, "pointer-events-none absolute rounded-full bg-destructive")}
      style={{
        left: `${(cell % width + 0.22) / width * 100}%`,
        top: `${(Math.floor(cell / width) + 0.22) / height * 100}%`,
        width: `${0.56 / width * 100}%`,
        height: `${0.56 / height * 100}%`,
        "--food-delay": foodDelay,
      } as CSSProperties}
    />
  );

  const modePickerField = (
    <div className="space-y-2">
      <span id={modeLabelId} className="text-sm text-muted-foreground">Board size</span>
      <Select value={mode} disabled={layoutEditing} onValueChange={value => {
        const next = modes.find(item => item.id === value);
        if (!next) return;
        turns.current = []; heading.current = "right";
        setMode(next.id);
        setGame(initial(next.width, next.height));
        setSaveError(false);
      }}>
        <SelectTrigger ref={modePicker} aria-labelledby={modeLabelId} placeholder="Choose board" className="w-full" />
        <SelectContent>{modes.map((item, index) => (
          <SelectItem key={item.id} index={index} value={item.id}>{item.label} · {item.width} × {item.height}</SelectItem>
        ))}</SelectContent>
      </Select>
    </div>
  );
  const startButton = (
    <Button size="lg" leadingIcon={Play} disabled={layoutEditing || !mode} onClick={start}>
      {game.status === "paused" ? "Resume" : "Start"}
    </Button>
  );

  return (
    <Panel
      title="Snake"
      action={view === "game" && !locked ? <span className="text-sm text-muted-foreground">Score <span className="ml-1 font-semibold tabular-nums text-foreground" aria-live="polite">{score}</span></span> : undefined}
    >
      <div className={cn(styles.widget, "relative")} onKeyDownCapture={() => setKeyboardUsed(true)}>
        <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={locked ? "locked" : view}
          className="h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: spring.moderate.exit }}
          transition={spring.moderate}
        >
        {lock ? (
          <ClassLockNotice lock={lock} gamePaused={game.status === "paused"} />
        ) : view === "setup" ? (
          <div className="mx-auto flex h-full w-full max-w-xs flex-col justify-center gap-5">
            {modePickerField}
            <div className="flex flex-wrap items-center gap-2">
              {startButton}
              <Button size="lg" variant="ghost" leadingIcon={Trophy} disabled={layoutEditing} onClick={showLeaderboard}>Leaderboard</Button>
            </div>
          </div>
        ) : view === "leaderboard" ? (
          <div className={styles.leaderboard}>
            {modePickerField}
            <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain" tabIndex={0} role="region" aria-label="School leaderboard">
              <h4 className="mb-2 font-medium">School leaderboard</h4>
              {mode ? <SchoolLeaderboard mode={mode} /> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {startButton}
              <Button size="lg" variant="ghost" disabled={layoutEditing} onClick={() => setView(leaderboardOrigin.current === "game" && game.status !== "ready" ? "game" : "setup")}>Back</Button>
            </div>
          </div>
        ) : (
          <div className={styles.workspace}>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{selected?.label} <span className="ml-1 tabular-nums">{width} × {height}</span></span>
              {game.status === "playing" ? <Button variant="secondary" leadingIcon={Pause} disabled={layoutEditing} onClick={() => setGame(prev => ({ ...prev, status: "paused" }))}>Pause</Button> : null}
            </div>
            <div className={styles.stage}>
              <div
                ref={board}
                tabIndex={layoutEditing ? -1 : 0}
                role="application"
                aria-label="Snake game"
                aria-describedby={instructionsId}
                className={cn(styles.board, "relative isolate overflow-hidden rounded-2xl bg-muted outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring")}
                style={{ "--board-ratio": width / height } as CSSProperties}
                onBlur={event => {
                  if (pressingControl.current || event.currentTarget.contains(event.relatedTarget)) return;
                  setGame(prev => prev.status === "playing" ? { ...prev, status: "paused" } : prev);
                }}
                onKeyDown={event => {
                  if (layoutEditing || event.altKey || event.ctrlKey || event.metaKey) return;
                  const direction = keys[event.key.toLowerCase()];
                  if (direction) {
                    event.preventDefault();
                    if (event.repeat) return;
                    if (game.status === "playing") steer(direction);
                  } else if (event.target === event.currentTarget && event.key === " ") {
                    event.preventDefault();
                    if (game.status === "playing") setGame(prev => ({ ...prev, status: "paused" }));
                    else if (game.status === "paused") start();
                  }
                }}
              >
                <div className="grid" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
                  {squares}
                </div>
                {game.eaten !== undefined && game.status === "playing" ? foodDot(game.eaten, styles.eaten, `eaten-${game.eaten}`) : null}
                {foodDot(game.food, styles.food, game.food)}
                <SnakeBody snake={game.snake} direction={game.direction} width={width} height={height} duration={tickMs(score)} playing={game.status === "playing" && !layoutEditing} />
                <AnimatePresence>
                {game.status === "paused" || finished ? (
                  <motion.div
                    key="overlay"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/90 px-4 text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: spring.moderate.exit }}
                    transition={spring.moderate}
                  >
                    <div role="status">
                      <p className="text-xl font-semibold">{finished ? game.status === "won" ? "Board cleared" : "Game over" : "Paused"}</p>
                      {finished ? <p className="mt-1 text-sm text-muted-foreground">{score} {score === 1 ? "point" : "points"}</p> : null}
                    </div>
                    <Button size="lg" leadingIcon={Play} disabled={layoutEditing} onClick={start}>{finished ? "Play again" : "Resume"}</Button>
                  </motion.div>
                ) : null}
                </AnimatePresence>
              </div>
            </div>
            <div className={styles.footer}>
              <div className="flex min-h-0 items-center justify-center">
                <p id={instructionsId} className={cn("text-center text-xs text-muted-foreground", !keyboardUsed && styles.keyboardHint)}>WASD / arrows · Space to pause</p>
                {!keyboardUsed && game.status === "playing" ? (
                  <div className={cn(styles.touchControls, "w-fit grid-cols-3 gap-3")} role="group" aria-label="Direction controls">
                    {controls.map(({ direction, icon: Icon }, index) => <Button key={direction} type="button" size="icon" variant="secondary" disabled={layoutEditing} onPointerDown={event => { event.preventDefault(); pressingControl.current = true; }} onPointerCancel={() => { pressingControl.current = false; }} onClick={() => { pressingControl.current = false; steer(direction); board.current?.focus({ preventScroll: true }); }} aria-label={`Move ${direction}`} className={index === 0 ? "col-start-2" : index === 1 ? "col-start-1 row-start-2" : "row-start-2"}><Icon aria-hidden /></Button>)}
                  </div>
                ) : null}
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2">
                <Button variant="ghost" leadingIcon={ArrowLeft} disabled={layoutEditing} onClick={showSetup}>Back</Button>
                <Button variant="ghost" leadingIcon={Trophy} disabled={layoutEditing} onClick={showLeaderboard}>Leaderboard</Button>
              </div>
              <div role="status" className="flex min-w-0 items-center justify-center gap-2 text-xs text-muted-foreground">
                {saveError ? <>Score not saved.<Button size="sm" variant="ghost" onClick={() => {
                  if (!mode) return;
                  setSaveError(false);
                  void submit({ mode, score }).catch(() => setSaveError(true));
                }}>Retry</Button></> : null}
              </div>
            </div>
          </div>
        )}
        </motion.div>
        </AnimatePresence>
      </div>
    </Panel>
  );
}

function ClassLockNotice({ lock, gamePaused }: { lock: ClassLock; gamePaused: boolean }) {
  const user = useCurrentUser();
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon"><BellRing aria-hidden /></EmptyMedia>
        <EmptyTitle>{lock.label} is in session</EmptyTitle>
        <EmptyDescription>{lock.joke}</EmptyDescription>
      </EmptyHeader>
      <p className="text-xs text-muted-foreground tabular-nums">
        Snake opens at {formatClockTime(lock.endTime, user?.use24HourTime ?? false)}
        {gamePaused ? " · Your game is paused" : ""}
      </p>
    </Empty>
  );
}
