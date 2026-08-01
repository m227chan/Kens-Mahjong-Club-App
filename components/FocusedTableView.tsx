"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameSync } from "@/contexts/GameSyncContext";
import ScoreCelebration, {
  type ScoreCelebrationResult,
} from "@/components/ScoreCelebration";
import {
  subscribeActiveSession,
  subscribePlayers,
  subscribeScoringRules,
} from "@/lib/data";
import { calculateTableScores, type TableWinType } from "@/lib/table-scoring";
import {
  basePointsForFan,
  DEFAULT_SCORING_RULES,
  fanLabel,
  fanValues,
  type ScoringRules,
} from "@/lib/scoring-rules";
import {
  generateTableQr,
  tableAction,
  type TableContext,
  type TablePlayer,
  type TableQr,
  type TableSession,
} from "@/lib/table-checkin-client";
import {
  optimisticallyClearTable,
  optimisticallyRemovePlayer,
  optimisticallySeatPlayer,
} from "@/lib/optimistic-session";

type MutationResult =
  | { status: "ok"; session: TableSession }
  | { status: "table_full"; occupants: string[]; session: TableSession };

export default function FocusedTableView({
  clubId,
  tableNumber,
}: {
  clubId: string;
  tableNumber: number;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { play } = useSound();
  const { saveGame: saveGameWithOfflineSupport } = useGameSync();
  const [context, setContext] = useState<TableContext | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [players, setPlayers] = useState<TablePlayer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [qr, setQr] = useState<TableQr | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [flash, setFlash] = useState<ScoreCelebrationResult | null>(null);
  const [winner, setWinner] = useState("");
  const [winType, setWinType] = useState<TableWinType | "">("");
  const [loser, setLoser] = useState("");
  const [scoringRules, setScoringRules] = useState<ScoringRules>(
    DEFAULT_SCORING_RULES,
  );
  const [fan, setFan] = useState(DEFAULT_SCORING_RULES.minFan);
  const requestKey = useRef("");
  const sessionRef = useRef<TableSession | null>(null);
  const confirmedSessionRef = useRef<TableSession | null>(null);
  const pendingTableMutationsRef = useRef(0);
  const tableMutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const showSession = useCallback((next: TableSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const acceptServerSession = useCallback((next: TableSession | null) => {
    confirmedSessionRef.current = next;
    if (pendingTableMutationsRef.current === 0) showSession(next);
  }, [showSession]);

  const loadContext = useCallback(async () => {
    const next = await tableAction<TableContext>({
      action: "context",
      clubId,
      tableNumber,
    });
    setContext(next);
    acceptServerSession(next.session);
    setPlayers(next.players);
  }, [acceptServerSession, clubId, tableNumber]);

  useEffect(() => {
    document.body.classList.add("table-focus-mode");
    return () => document.body.classList.remove("table-focus-mode");
  }, []);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    else if (user)
      void loadContext().catch((nextError) =>
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to load table.",
        ),
      );
  }, [loadContext, loading, router, user]);
  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(
      () => {
        void loadContext().catch((nextError) =>
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to refresh table.",
          ),
        );
      },
      5 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [loadContext, user]);
  useEffect(() => {
    if (!context) return;
    const unsubscribeSession = subscribeActiveSession(
      clubId,
      context.seasonNumber,
      (next) =>
        acceptServerSession(
          next
            ? {
                id: next.id,
                seasonNumber: next.seasonNumber ?? context.seasonNumber,
                tableCount: next.tableCount,
                participants: next.participants,
                tables: next.tables,
                sideline: next.sideline,
                revision: 0,
              }
            : null,
        ),
    );
    const unsubscribePlayers = subscribePlayers(clubId, (next) =>
      setPlayers(
        next.map((player) => ({
          id: player.id,
          displayName: player.displayName,
          icon: player.icon,
          authUid: player.authUid,
        })),
      ),
    );
    return () => {
      unsubscribeSession();
      unsubscribePlayers();
    };
  }, [acceptServerSession, clubId, context]);
  useEffect(() => {
    if (!user) return;
    return subscribeScoringRules(clubId, setScoringRules);
  }, [clubId, user]);
  useEffect(() => {
    if (fan < scoringRules.minFan || fan > scoringRules.maxFan)
      setFan(scoringRules.minFan);
  }, [fan, scoringRules]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 2200);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const occupants = useMemo(
    () => session?.tables[String(tableNumber)] ?? [],
    [session, tableNumber],
  );
  const player = useCallback(
    (id: string) =>
      players.find((item) => item.id === id) ?? {
        id,
        displayName: id,
        icon: "👤",
        authUid: null,
      },
    [players],
  );
  const filteredPlayers = useMemo(
    () =>
      players.filter(
        (item) =>
          !occupants.includes(item.id) &&
          item.displayName
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
      ),
    [occupants, players, search],
  );
  const scorePreview = useMemo(() => {
    if (!winner || !winType || (winType === "discard" && !loser)) return null;
    return calculateTableScores({
      players: occupants,
      winner,
      winType,
      loser,
      fan,
      rules: scoringRules,
    });
  }, [fan, loser, occupants, scoringRules, winType, winner]);

  const mutate = (
    action: string,
    values: Record<string, unknown> = {},
  ) => {
    const current = sessionRef.current;
    if (!current) return false;
    const playerId = typeof values.playerId === "string" ? values.playerId : "";
    const optimistic = action === "seat" && playerId
      ? optimisticallySeatPlayer(current, String(tableNumber), playerId)
      : action === "remove" && playerId
        ? optimisticallyRemovePlayer(current, String(tableNumber), playerId)
        : action === "clear"
          ? optimisticallyClearTable(current, String(tableNumber))
          : current;
    if (action === "seat" && optimistic === current) {
      setError("This table is already full.");
      play("error");
      return false;
    }

    setError(null);
    showSession(optimistic);
    play("tile");
    pendingTableMutationsRef.current += 1;
    tableMutationQueueRef.current = tableMutationQueueRef.current.then(async () => {
      try {
        const result = await tableAction<MutationResult>({ action, clubId, tableNumber, ...values });
        confirmedSessionRef.current = result.session;
        if (result.status === "table_full") {
          throw new Error("This table filled up before the change was saved.");
        }
      } catch (nextError) {
        play("error");
        setError(nextError instanceof Error ? nextError.message : "Unable to update the table. Your last change was reverted.");
      } finally {
        pendingTableMutationsRef.current -= 1;
        if (pendingTableMutationsRef.current === 0) showSession(confirmedSessionRef.current);
      }
    });
    return true;
  };

  const openResults = () => {
    setWinner("");
    setWinType("");
    setLoser("");
    setFan(scoringRules.minFan);
    requestKey.current = crypto.randomUUID();
    setResultOpen(true);
  };
  const saveGame = async (draw = false) => {
    if (!user || occupants.length !== 4 || !session) return;
    const scores = draw
      ? Object.fromEntries(occupants.map((id) => [id, 0]))
      : calculateTableScores({
          players: occupants,
          winner,
          winType: winType as TableWinType,
          loser,
          fan,
          rules: scoringRules,
        });
    if (!scores) {
      setError(
        "Choose a winner, win type, fan value, and discard player when required.",
      );
      return;
    }
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    setBusy(true);
    setError(null);
    try {
      const result = await saveGameWithOfflineSupport(clubId, {
        entries: Object.entries(scores).map(([playerId, score]) => ({
          playerId,
          score,
        })),
        createdBy: user.uid,
        seasonNumber: session.seasonNumber,
        tableId: String(tableNumber),
        winType: draw ? "draw" : winType === "self" ? "self_draw" : "discard",
        loserPlayerId: draw || winType === "self" ? null : loser,
        fan: draw ? null : fan,
        notes: null,
        idempotencyKey: requestKey.current,
      });
      setResultOpen(false);
      requestKey.current = "";
      play(draw ? "draw" : "win");
      setFlash({ scores, winner: draw ? null : winner });
      setToast(result.status === "synced"
        ? draw ? "Draw synced." : "Game synced!"
        : result.status === "queued"
          ? `${draw ? "Draw" : "Game"} saved on this device. It will sync when the connection returns.`
          : `${draw ? "Draw" : "Game"} saved on this device, but syncing needs attention.`);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save the game.",
      );
    } finally {
      setBusy(false);
    }
  };

  const showQr = async () => {
    setBusy(true);
    setError(null);
    try {
      setQr((await generateTableQr(clubId, tableNumber))[0]);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to generate QR code.",
      );
    } finally {
      setBusy(false);
    }
  };
  const downloadQr = () => {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([qr.svg], { type: "image/svg+xml" }),
    );
    link.download = `${clubId}-table-${tableNumber}-qr.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading || !user || !context)
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="rounded-lg border bg-white p-6 font-bold">
          Loading focused table…
        </div>
      </main>
    );

  return (
    <main className="focused-table min-h-dvh bg-[rgb(var(--paper))] pb-28">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))]/95 px-3 py-3 backdrop-blur">
        <Link
          href={`/club/${encodeURIComponent(clubId)}`}
          aria-label="Back to club"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--line))] text-2xl"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-[.15em] text-[rgb(var(--muted))]">
            {context.clubName}
          </p>
          <h1 className="text-xl font-black text-[rgb(var(--ink))]">
            Table {tableNumber}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void showQr()}
          className="min-h-11 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] px-3 text-sm font-black"
        >
          QR
        </button>
        <button
          type="button"
          disabled={!session || busy}
          onClick={() =>
            window.confirm(`Clear everyone from Table ${tableNumber}?`) &&
            void mutate("clear")
          }
          aria-label="Clear table"
          className="h-11 w-11 rounded-lg border border-[rgb(var(--line))] text-lg font-black"
        >
          ×
        </button>
      </header>

      <div className="mx-auto max-w-xl p-3 sm:p-5">
        {error ? (
          <p
            role="alert"
            className="mb-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-800"
          >
            {error}
          </p>
        ) : null}
        {toast ? (
          <p
            role="status"
            className="mb-3 rounded-lg bg-[rgb(var(--bamboo))] p-3 text-center text-sm font-black text-white"
          >
            {toast}
          </p>
        ) : null}
        {!session ? (
          <section className="rounded-xl border border-dashed border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-8 text-center">
            <h2 className="text-xl font-black">No active session</h2>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Scan this table&apos;s QR code to check in and start one
              automatically.
            </p>
            <button
              onClick={() => void showQr()}
              className="mt-5 min-h-12 rounded-lg bg-[rgb(var(--bamboo))] px-5 font-black text-white"
            >
              Generate table QR
            </button>
          </section>
        ) : (
          <>
            <section
              className="grid grid-cols-2 gap-3"
              aria-label={`Table ${tableNumber} seats`}
            >
              {Array.from({ length: 4 }, (_, index) => {
                const id = occupants[index];
                if (!id)
                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={busy}
                      onClick={() => setPickerOpen(true)}
                      className="min-h-36 rounded-xl border-2 border-dashed border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-sm font-black text-[rgb(var(--bamboo))]"
                    >
                      <span className="block text-3xl">＋</span>Add player
                    </button>
                  );
                const info = player(id);
                return (
                  <article
                    key={id}
                    className="relative flex min-h-36 flex-col items-center justify-center rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 text-center shadow-sm"
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void mutate("remove", { playerId: id })}
                      aria-label={`Remove ${info.displayName}`}
                      className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] font-black"
                    >
                      ×
                    </button>
                    <span className="text-4xl">{info.icon}</span>
                    <h2 className="mt-2 max-w-full truncate text-base font-black">
                      {info.displayName}
                    </h2>
                    {info.authUid === user.uid ? (
                      <span className="mt-1 rounded-full bg-[rgb(var(--bamboo)/.12)] px-2 py-1 text-[10px] font-black uppercase text-[rgb(var(--bamboo))]">
                        You
                      </span>
                    ) : null}
                  </article>
                );
              })}
            </section>
            <p
              className={`mt-4 rounded-lg p-3 text-center text-sm font-black ${occupants.length === 4 ? "bg-[rgb(var(--bamboo)/.12)] text-[rgb(var(--bamboo))]" : "bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]"}`}
            >
              {occupants.length === 4
                ? "Ready to score"
                : `${occupants.length} of 4 players · add ${4 - occupants.length} more`}
            </p>
          </>
        )}
      </div>

      <footer className="focused-table-actions fixed inset-x-0 z-20 mx-auto flex max-w-xl gap-2 border-t border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={occupants.length !== 4 || busy}
          onClick={() => {
            requestKey.current = crypto.randomUUID();
            void saveGame(true);
          }}
          className="min-h-12 flex-1 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] font-black disabled:opacity-40"
        >
          Draw (0 pts)
        </button>
        <button
          type="button"
          disabled={occupants.length !== 4 || busy}
          onClick={openResults}
          className="min-h-12 flex-1 rounded-lg bg-[rgb(var(--bamboo))] font-black text-white disabled:opacity-40"
        >
          Winner…
        </button>
      </footer>

      {pickerOpen ? (
        <div
          className="viewport-overlay fixed inset-0 z-50 flex items-end bg-black/60"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setPickerOpen(false)
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="focused-player-picker-title"
            className="playful-sheet max-h-[88dvh] w-full flex flex-col rounded-t-2xl bg-[rgb(var(--surface))]"
          >
            <div className="flex-shrink-0 p-4 pb-0">
              <div className="mx-auto max-w-xl">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 id="focused-player-picker-title" className="text-xl font-black">Add players</h2>
                  <button
                    type="button"
                    aria-label="Close player picker"
                    onClick={() => {
                      setPickerOpen(false);
                      setSearch("");
                    }}
                    className="h-11 w-11 rounded-full border"
                  >
                    ×
                  </button>
                </div>

                {/* Seated players chips */}
                {occupants.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {occupants.map((id) => {
                      const info = player(id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--bamboo)/.4)] bg-[rgb(var(--bamboo)/.1)] pl-2 pr-1 py-1 text-sm font-black text-[rgb(var(--bamboo))]"
                        >
                          <span>{info.icon}</span>
                          <span className="max-w-[120px] truncate">
                            {info.displayName}
                          </span>
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Remove ${info.displayName}`}
                            onClick={() =>
                              void mutate("remove", { playerId: id })
                            }
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--bamboo)/.2)] text-xs font-black leading-none hover:bg-[rgb(var(--bamboo)/.35)]"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Seat counter */}
                <p className="mt-3 text-xs font-bold text-[rgb(var(--muted))]">
                  {occupants.length === 4
                    ? "Table is full"
                    : `${occupants.length} of 4 seated · select ${4 - occupants.length} more`}
                </p>

                {/* Search */}
                <input
                  aria-label="Search the club roster"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search roster…"
                  className="mt-2 min-h-12 w-full rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] px-3"
                />
              </div>
            </div>

            {/* Scrollable player list */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto max-w-xl space-y-2">
                {occupants.length === 4 ? (
                  <p className="py-6 text-center text-sm font-bold text-[rgb(var(--muted))]">
                    All 4 seats are filled.
                  </p>
                ) : filteredPlayers.length === 0 ? (
                  <p className="py-6 text-center text-sm font-bold text-[rgb(var(--muted))]">
                    No players match your search.
                  </p>
                ) : (
                  filteredPlayers.map((item) => {
                    const other = Object.entries(session?.tables ?? {}).find(
                      ([, ids]) => ids.includes(item.id),
                    )?.[0];
                    const status = other
                      ? `Table ${other}`
                      : session?.sideline.includes(item.id)
                        ? "Sideline"
                        : "Not in session";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={busy || occupants.length >= 4}
                        onClick={async () => {
                          if (
                            other &&
                            !window.confirm(
                              `Move ${item.displayName} from Table ${other} to Table ${tableNumber}?`,
                            )
                          )
                            return;
                          const ok = await mutate("seat", {
                            playerId: item.id,
                          });
                          // Auto-close only when table is now full
                          if (ok && occupants.length + 1 >= 4) {
                            setPickerOpen(false);
                            setSearch("");
                          }
                        }}
                        className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-[rgb(var(--line))] px-3 text-left disabled:opacity-40"
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate font-black">
                          {item.displayName}
                        </span>
                        <span className="text-xs font-bold text-[rgb(var(--muted))]">
                          {status}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Done button */}
            <div className="flex-shrink-0 border-t border-[rgb(var(--line))] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto max-w-xl">
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    setSearch("");
                  }}
                  className="min-h-12 w-full rounded-lg bg-[rgb(var(--ink))] font-black text-[rgb(var(--surface))]"
                >
                  Done
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {resultOpen ? (
        <div className="viewport-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/65 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="focused-result-title"
            className="playful-sheet focused-result-sheet flex max-h-[92dvh] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[rgb(var(--surface))] sm:rounded-xl"
          >
            <div className="z-10 flex shrink-0 items-center justify-between border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 pb-3 pt-4">
              <h2 id="focused-result-title" className="text-xl font-black">Record winner</h2>
              <button
                type="button"
                aria-label="Close result editor"
                onClick={() => setResultOpen(false)}
                className="h-11 w-11 rounded-full border"
              >
                ×
              </button>
            </div>
            <div className="focused-result-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-[rgb(var(--muted))]">
              Who won?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {occupants.map((id) => {
                const info = player(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={winner === id}
                    onClick={() => {
                      setWinner(id);
                      if (loser === id) setLoser("");
                    }}
                    className={`min-h-16 rounded-lg border p-2 font-black ${winner === id ? "border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo))] text-white" : "border-[rgb(var(--line))]"}`}
                  >
                    {info.icon} {info.displayName}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-[rgb(var(--muted))]">
              How?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={winType === "self"}
                onClick={() => {
                  setWinType("self");
                  setLoser("");
                }}
                className={`min-h-12 rounded-lg border font-black ${winType === "self" ? "bg-[rgb(var(--bamboo))] text-white" : ""}`}
              >
                Self-draw
              </button>
              <button
                type="button"
                aria-pressed={winType === "discard"}
                onClick={() => setWinType("discard")}
                className={`min-h-12 rounded-lg border font-black ${winType === "discard" ? "bg-[rgb(var(--cinnabar))] text-white" : ""}`}
              >
                Discard win
              </button>
            </div>
            {winType === "discard" ? (
              <>
                <p className="mt-4 text-xs font-black uppercase tracking-widest text-[rgb(var(--muted))]">
                  Who discarded?
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {occupants
                    .filter((id) => id !== winner)
                    .map((id) => {
                      const info = player(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={loser === id}
                          onClick={() => setLoser(id)}
                          className={`min-h-12 rounded-lg border text-sm font-black ${loser === id ? "bg-[rgb(var(--cinnabar))] text-white" : ""}`}
                        >
                          {info.icon} {info.displayName}
                        </button>
                      );
                    })}
                </div>
              </>
            ) : null}
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-[rgb(var(--muted))]">
              Fan
            </p>
            <div className="fan-choice-grid mt-2 grid grid-cols-6 gap-1" role="group" aria-label="Fan value">
              {fanValues(scoringRules).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={fan === value}
                  onClick={() => setFan(value)}
                  className={`min-h-11 rounded border text-sm font-black ${fan === value ? "bg-[rgb(var(--bamboo))] text-white" : ""}`}
                >
                  {fanLabel(value, scoringRules)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-right text-xs font-bold text-[rgb(var(--muted))]">
              {basePointsForFan(fan, scoringRules)} base points
            </p>
            {scorePreview ? (
              <div
                className="focused-score-preview mt-4 grid grid-cols-2 gap-2 rounded-xl border p-2 shadow-inner"
                aria-label="Calculated score changes"
                aria-live="polite"
              >
                {occupants.map((id) => {
                  const info = player(id);
                  const score = scorePreview[id] ?? 0;
                  return (
                    <div
                      key={id}
                      className="focused-score-preview-item rounded-lg px-3 py-2"
                    >
                      <div className="truncate text-xs font-bold text-white/80">
                        {info.icon} {info.displayName}
                      </div>
                      <div
                        className={`mt-1 text-lg font-black ${score > 0 ? "text-emerald-300" : score < 0 ? "text-rose-300" : "text-slate-300"}`}
                      >
                        {score > 0 ? `+${score}` : score}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            </div>
            <div className="focused-result-actions shrink-0 border-t border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                disabled={busy || !scorePreview}
                onClick={() => void saveGame(false)}
                className="min-h-12 w-full rounded-lg bg-[rgb(var(--bamboo))] font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Saving…" : "Save result"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <ScoreCelebration result={flash} player={player} />

      {qr ? (
        <div className="viewport-overlay qr-single-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="focused-qr-title" className="qr-single-card w-full max-w-sm rounded-xl bg-white p-5 text-center text-slate-950">
            <h2 id="focused-qr-title" className="text-2xl font-black">Table {tableNumber}</h2>
            <div
              className="mx-auto mt-3 w-full max-w-[300px]"
              dangerouslySetInnerHTML={{ __html: qr.svg }}
            />
            <p className="mt-2 text-sm font-bold text-slate-600">
              Scan to check in and keep score
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={downloadQr}
                className="min-h-11 rounded-lg border font-black"
              >
                Download
              </button>
              <button
                onClick={() => window.print()}
                className="min-h-11 rounded-lg border font-black"
              >
                Print
              </button>
            </div>
            <button
              onClick={() => setQr(null)}
              className="mt-2 min-h-11 w-full rounded-lg bg-slate-900 font-black text-white"
            >
              Close
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
