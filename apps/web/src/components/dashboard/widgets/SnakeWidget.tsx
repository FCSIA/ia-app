"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, Trophy } from "lucide-react";
import { api } from "~/apps/convex/src/_generated/api";
import { useMutation, useQuery } from "@/lib/convex-react";
import { Panel } from "@/components/layout/page-frame";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import styles from "./snake-widget.module.css";

type Direction = "up" | "down" | "left" | "right";
type Mode = "small" | "medium" | "large" | "extra-large";
type View = "setup" | "leaderboard" | "game";
type Game = {
  snake: number[];
  food: number;
  direction: Direction;
  status: "ready" | "playing" | "paused" | "over" | "won";
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
const opposite: Record<Direction, Direction> = { up: "down", down: "up", left: "right", right: "left" };
const keys: Partial<Record<string, Direction>> = {
  arrowup: "up", arrowdown: "down", arrowleft: "left", arrowright: "right",
  w: "up", s: "down", a: "left", d: "right",
};
const controls = [
  { direction: "up", icon: ArrowUp }, { direction: "left", icon: ArrowLeft },
  { direction: "down", icon: ArrowDown }, { direction: "right", icon: ArrowRight },
] as const;
const headRotation: Record<Direction, number> = { right: 0, down: 90, left: 180, up: 270 };

/** Only adjacent body segments connect, even when the snake curls beside itself. */
function segmentStyle(snake: number[], index: number, width: number): CSSProperties {
  const cell = snake[index];
  const neighbors = [snake[index - 1], snake[index + 1]];
  const left = cell % width > 0 && neighbors.includes(cell - 1);
  const right = cell % width < width - 1 && neighbors.includes(cell + 1);
  const up = neighbors.includes(cell - width);
  const down = neighbors.includes(cell + width);
  return {
    left: left ? 0 : "9%", right: right ? 0 : "9%",
    top: up ? 0 : "9%", bottom: down ? 0 : "9%",
    borderTopLeftRadius: !up && !left ? "40%" : 0,
    borderTopRightRadius: !up && !right ? "40%" : 0,
    borderBottomLeftRadius: !down && !left ? "40%" : 0,
    borderBottomRightRadius: !down && !right ? "40%" : 0,
  };
}

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
  const submit = useMutation(api.dashboard.snake.submit);
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

  useEffect(() => {
    if (game.status !== "playing" || layoutEditing || view !== "game") return;
    const timer = window.setInterval(() => {
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
        if (!eating) return { ...prev, snake, direction };
        const free = Array.from({ length: width * height }, (_, i) => i).filter(i => !snake.includes(i));
        if (!free.length) return { ...prev, snake, direction, status: "won" };
        return { ...prev, snake, direction, food: free[Math.floor(random * free.length)] };
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [game.status, layoutEditing, view, width, height]);

  useEffect(() => {
    if (!finished || score === 0 || !mode) return;
    let active = true;
    void submit({ mode, score }).catch(() => { if (active) setSaveError(true); });
    return () => { active = false; };
  }, [finished, score, mode, submit]);

  useEffect(() => {
    const changedView = previousView.current !== view;
    previousView.current = view;
    if (layoutEditing) return;
    if (view === "game" && (changedView || game.status === "playing")) {
      board.current?.focus({ preventScroll: true });
    } else if (changedView) modePicker.current?.focus({ preventScroll: true });
  }, [view, game.status, layoutEditing]);

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
    if (layoutEditing) setGame(prev => prev.status === "playing" ? { ...prev, status: "paused" } : prev);
  }, [layoutEditing]);

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
      action={view === "game" ? <span className="text-sm text-muted-foreground">Score <span className="ml-1 font-semibold tabular-nums text-foreground" aria-live="polite">{score}</span></span> : undefined}
    >
      <div className={styles.widget} onKeyDownCapture={() => setKeyboardUsed(true)}>
        {view === "setup" ? (
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
                  if (!event.currentTarget.contains(event.relatedTarget)) setGame(prev => prev.status === "playing" ? { ...prev, status: "paused" } : prev);
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
                  {Array.from({ length: width * height }, (_, cell) => {
                    const segment = game.snake.indexOf(cell);
                    return (
                      <span key={cell} aria-hidden className={cn("relative aspect-square", (Math.floor(cell / width) + cell % width) % 2 === 0 ? styles.lightSquare : styles.darkSquare)}>
                        {segment !== -1 ? <span className="absolute bg-primary" style={segmentStyle(game.snake, segment, width)}>
                          {segment === 0 ? <svg viewBox="0 0 24 24" className="absolute inset-0 size-full fill-primary-foreground" style={{ transform: `rotate(${headRotation[game.direction]}deg)` }}><circle cx="16" cy="7.5" r="1.6" /><circle cx="16" cy="16.5" r="1.6" /></svg> : null}
                        </span> : game.food === cell ? <span className="absolute inset-[22%] rounded-full bg-destructive" /> : null}
                      </span>
                    );
                  })}
                </div>
                {game.status === "paused" || finished ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/90 px-4 text-center">
                    <div role="status">
                      <p className="text-xl font-semibold">{finished ? game.status === "won" ? "Board cleared" : "Game over" : "Paused"}</p>
                      {finished ? <p className="mt-1 text-sm text-muted-foreground">{score} {score === 1 ? "point" : "points"}</p> : null}
                    </div>
                    <Button size="lg" leadingIcon={Play} disabled={layoutEditing} onClick={start}>{finished ? "Play again" : "Resume"}</Button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className={styles.footer}>
              <div className="flex min-h-0 items-center justify-center">
                <p id={instructionsId} className={cn("text-center text-xs text-muted-foreground", !keyboardUsed && styles.keyboardHint)}>WASD / arrows · Space to pause</p>
                {!keyboardUsed && game.status === "playing" ? (
                  <div className={cn(styles.touchControls, "w-fit grid-cols-3 gap-3")} role="group" aria-label="Direction controls">
                    {controls.map(({ direction, icon: Icon }, index) => <Button key={direction} type="button" size="icon" variant="secondary" disabled={layoutEditing} onPointerDown={event => event.preventDefault()} onClick={() => { steer(direction); board.current?.focus({ preventScroll: true }); }} aria-label={`Move ${direction}`} className={index === 0 ? "col-start-2" : index === 1 ? "col-start-1 row-start-2" : "row-start-2"}><Icon aria-hidden /></Button>)}
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
      </div>
    </Panel>
  );
}
