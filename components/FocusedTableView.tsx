"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSound } from "@/contexts/SoundContext";
import { useGameSync } from "@/contexts/GameSyncContext";
import ScoreCelebration, {
  type ScoreCelebrationResult,
} from "@/components/ScoreCelebration";
import ScoreCalculatorModal from "@/components/ScoreCalculatorModal";
import {
  requestToJoinClub,
  subscribeActiveSession,
  subscribePlayers,
  subscribePlayerStats,
  subscribeScoringRules,
  loadAllGames,
} from "@/lib/data";
import type { PlayerStatsDoc } from "@/lib/types";
import { aggregatePlayerGames } from "@/lib/standings-analytics";
import {
  clearGuestTableSession,
  exitGuestTableToLogin,
  guestSessionMatches,
} from "@/lib/guest-table-session";
import { calculateTableScores, type TableWinType } from "@/lib/table-scoring";
import {
  basePointsForFan,
  DEFAULT_SCORING_RULES,
  fanLabel,
  fanValues,
  type ScoringRules,
} from "@/lib/scoring-rules";
import {
  createGuestGame,
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
import FocusedWindLayout, {
  buildWindSeatCards,
} from "@/components/FocusedWindLayout";
import { StaticMahjongTile } from "@/components/MahjongTile";
import {
  WINDS,
  WIND_LABELS,
  continueWindsAfterRosterChange,
  nextWindState,
  seatWindForPlayer,
  upsertTableWind,
  type TableWindState,
} from "@/lib/table-winds";
import type { Wind } from "@/lib/hand-scoring/types";
import {
  DEFAULT_WIND_ROTATION_SETTINGS,
  type WindRotationSettings,
} from "@/lib/wind-rotation-settings";

const LAYOUT_STORAGE_KEY = "focused-table-layout";
type FocusedLayoutMode = "wind" | "basic";

function readLayoutPreference(): FocusedLayoutMode {
  if (typeof window === "undefined") return "wind";
  try {
    const value = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    return value === "basic" ? "basic" : "wind";
  } catch {
    return "wind";
  }
}

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
  const { user, loading, signingIn, signInWithGoogle, signOut } = useAuth();
  const { play } = useSound();
  const { saveGame: saveGameWithOfflineSupport } = useGameSync();
  const [isGuest, setIsGuest] = useState(false);
  const [guestReady, setGuestReady] = useState(false);
  const [context, setContext] = useState<TableContext | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [players, setPlayers] = useState<TablePlayer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [qr, setQr] = useState<TableQr | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [flash, setFlash] = useState<ScoreCelebrationResult | null>(null);
  const [winner, setWinner] = useState("");
  const [winType, setWinType] = useState<TableWinType | "">("");
  const [loser, setLoser] = useState("");
  const [scoringRules, setScoringRules] = useState<ScoringRules>(
    DEFAULT_SCORING_RULES,
  );
  const [windRotation, setWindRotation] = useState<WindRotationSettings>(
    DEFAULT_WIND_ROTATION_SETTINGS,
  );
  const [layoutMode, setLayoutMode] = useState<FocusedLayoutMode>(() =>
    readLayoutPreference(),
  );
  const [tableScores, setTableScores] = useState<Record<string, number>>({});
  const [scoresTick, setScoresTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [windAdjustOpen, setWindAdjustOpen] = useState(false);
  const [restartPromptOpen, setRestartPromptOpen] = useState(false);
  const [windAnimating, setWindAnimating] = useState(false);
  const [fan, setFan] = useState(DEFAULT_SCORING_RULES.minFan);
  const [scoreCalculatorOpen, setScoreCalculatorOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const requestKey = useRef("");
  const sessionRef = useRef<TableSession | null>(null);
  const confirmedSessionRef = useRef<TableSession | null>(null);
  const pendingTableMutationsRef = useRef(0);
  const tableMutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWindRef = useRef<TableWindState | null>(null);
  const pendingCelebrationRef = useRef<ScoreCelebrationResult | null>(null);
  const pendingPostRotateSessionRef = useRef<TableSession | null>(null);
  const windAnimatingRef = useRef(false);
  const windHealKeyRef = useRef("");
  const canAccess = Boolean(user) || isGuest;

  const showSession = useCallback((next: TableSession | null) => {
    const normalized =
      next && next.tableWinds == null ? { ...next, tableWinds: {} } : next;
    sessionRef.current = normalized;
    setSession(normalized);
  }, []);

  const acceptServerSession = useCallback((next: TableSession | null) => {
    confirmedSessionRef.current = next;
    if (pendingTableMutationsRef.current === 0) showSession(next);
  }, [showSession]);

  const layoutModeRef = useRef(layoutMode);
  layoutModeRef.current = layoutMode;

  const ingestRemoteSession = useCallback(
    (next: TableSession | null) => {
      const key = String(tableNumber);
      const previous = sessionRef.current;
      const prevWind = previous?.tableWinds?.[key];
      const nextWind = next?.tableWinds?.[key];
      const dealerRotated =
        Boolean(prevWind && nextWind) &&
        prevWind!.dealerPlayerId !== nextWind!.dealerPlayerId;
      const windProgressed =
        Boolean(prevWind && nextWind) &&
        (prevWind!.dealerPlayerId !== nextWind!.dealerPlayerId ||
          prevWind!.handNumber !== nextWind!.handNumber ||
          prevWind!.roundWind !== nextWind!.roundWind);

      if (windAnimatingRef.current) {
        confirmedSessionRef.current = next;
        if (next) pendingPostRotateSessionRef.current = next;
        if (windProgressed || !prevWind) setScoresTick((tick) => tick + 1);
        return;
      }

      if (
        dealerRotated &&
        layoutModeRef.current === "wind" &&
        previous &&
        next
      ) {
        confirmedSessionRef.current = next;
        pendingPostRotateSessionRef.current = next;
        windAnimatingRef.current = true;
        setWindAnimating(true);
        setScoresTick((tick) => tick + 1);
        return;
      }

      acceptServerSession(next);
      if (windProgressed || (!prevWind && nextWind) || (prevWind && !nextWind)) {
        setScoresTick((tick) => tick + 1);
      }
    },
    [acceptServerSession, tableNumber],
  );

  const loadContext = useCallback(async () => {
    const next = await tableAction<TableContext>({
      action: "context",
      clubId,
      tableNumber,
    });
    setContext(next);
    ingestRemoteSession(next.session);
    setPlayers(next.players);
    if (next.scoringRules) setScoringRules(next.scoringRules);
    if (next.windRotation) {
      setWindRotation((current) =>
        current.mode === next.windRotation!.mode ? current : next.windRotation!,
      );
    }
  }, [clubId, ingestRemoteSession, tableNumber]);

  useEffect(() => {
    document.body.classList.add("table-focus-mode");
    return () => document.body.classList.remove("table-focus-mode");
  }, []);

  useEffect(() => {
    if (!session) {
      setTableScores((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
      return;
    }

    if (!isGuest && user) {
      return subscribePlayerStats(
        clubId,
        (stats: Array<PlayerStatsDoc & { id: string }>) => {
          const totals: Record<string, number> = {};
          for (const stat of stats) {
            totals[stat.playerId] = stat.totalPoints;
          }
          setTableScores(totals);
        },
        session.seasonNumber,
      );
    }

    let cancelled = false;
    void loadAllGames(clubId)
      .then((games) => {
        if (cancelled) return;
        const seasonGames = games.filter(
          (game) => game.seasonNumber === session.seasonNumber,
        );
        const aggregate = aggregatePlayerGames(seasonGames);
        const totals: Record<string, number> = {};
        for (const [playerId, row] of aggregate) {
          totals[playerId] = row.totalPoints;
        }
        setTableScores(totals);
      })
      .catch(() => {
        /* keep prior totals if reload fails */
      });
    return () => {
      cancelled = true;
    };
  }, [
    clubId,
    isGuest,
    scoresTick,
    session,
    session?.id,
    session?.seasonNumber,
    user,
  ]);
  useEffect(() => {
    if (!session || (!isGuest && user)) return;
    const timer = window.setInterval(() => {
      setScoresTick((tick) => tick + 1);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [isGuest, session?.id, user]);
  useEffect(() => {
    const guest = guestSessionMatches(clubId, tableNumber);
    if (user && guest && !upgradeBusy) {
      clearGuestTableSession();
      setIsGuest(false);
    } else {
      setIsGuest(guest);
    }
    setGuestReady(true);
  }, [clubId, tableNumber, upgradeBusy, user?.uid]);
  useEffect(() => {
    if (loading || !guestReady) return;
    if (!user && !isGuest) {
      router.replace("/login");
      return;
    }
    void loadContext().catch((nextError) =>
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load table.",
      ),
    );
    // router.replace is stable enough; omit router object identity from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid remount loops from unstable router refs
  }, [guestReady, isGuest, loadContext, loading, user?.uid]);
  useEffect(() => {
    if (!isGuest) return;
    const ensureGuestSession = () => {
      if (!guestSessionMatches(clubId, tableNumber)) {
        clearGuestTableSession();
        window.location.replace("/login");
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) ensureGuestSession();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", ensureGuestSession);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", ensureGuestSession);
    };
  }, [clubId, isGuest, tableNumber]);
  useEffect(() => {
    if (!canAccess) return;
    const intervalMs = isGuest ? 5_000 : 5 * 60 * 1000;
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
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [canAccess, isGuest, loadContext]);
  useEffect(() => {
    if (!context || isGuest) return;
    const unsubscribeSession = subscribeActiveSession(
      clubId,
      context.seasonNumber,
      (next) =>
        ingestRemoteSession(
          next
            ? {
                id: next.id,
                seasonNumber: next.seasonNumber ?? context.seasonNumber,
                tableCount: next.tableCount,
                participants: next.participants,
                tables: next.tables,
                sideline: next.sideline,
                tableWinds: next.tableWinds ?? {},
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
  }, [clubId, context, ingestRemoteSession, isGuest]);
  useEffect(() => {
    if (!user || isGuest) return;
    return subscribeScoringRules(clubId, setScoringRules);
  }, [clubId, isGuest, user]);
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
  const windState: TableWindState | undefined = session?.tableWinds?.[
    String(tableNumber)
  ];
  const playersById = useMemo(
    () => new Map(players.map((item) => [item.id, item])),
    [players],
  );
  const windCards = useMemo(() => {
    if (!windState || occupants.length !== 4) return [];
    return buildWindSeatCards(occupants, windState, playersById, tableScores);
  }, [occupants, windState, playersById, tableScores]);
  const dealerName = windState
    ? player(
        occupants.includes(windState.dealerPlayerId)
          ? windState.dealerPlayerId
          : (occupants[0] ?? windState.dealerPlayerId),
      ).displayName
    : null;
  const starterOpen =
    layoutMode === "wind" &&
    occupants.length === 4 &&
    !windState &&
    Boolean(session);

  useEffect(() => {
    if (
      !session ||
      layoutMode !== "wind" ||
      occupants.length !== 4 ||
      !windState ||
      busy ||
      windAnimating
    ) {
      return;
    }
    const seatOrderMatches =
      windState.seatOrder.length === 4 &&
      windState.seatOrder.every((id, index) => id === occupants[index]);
    if (
      seatOrderMatches &&
      occupants.includes(windState.dealerPlayerId)
    ) {
      return;
    }
    const healed = continueWindsAfterRosterChange(windState, occupants);
    if (!healed) return;
    if (
      healed.dealerPlayerId === windState.dealerPlayerId &&
      healed.roundStarterPlayerId === windState.roundStarterPlayerId &&
      healed.handNumber === windState.handNumber &&
      healed.roundWind === windState.roundWind &&
      healed.seatOrder.every((id, index) => id === windState.seatOrder[index])
    ) {
      return;
    }
    const healKey = `${session.revision}:${occupants.join(",")}:${windState.dealerPlayerId}`;
    if (windHealKeyRef.current === healKey) return;
    windHealKeyRef.current = healKey;
    void tableAction<{ status: string; session: TableSession }>({
      action: "setTableWinds",
      clubId,
      tableNumber,
      reconcile: true,
    })
      .then((result) => acceptServerSession(result.session))
      .catch(() => {
        windHealKeyRef.current = "";
      });
  }, [
    acceptServerSession,
    busy,
    clubId,
    layoutMode,
    occupants,
    session,
    tableNumber,
    windAnimating,
    windState,
  ]);

  const setLayoutPreference = (mode: FocusedLayoutMode) => {
    setLayoutMode(mode);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const persistStarter = async (starterPlayerId: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await tableAction<{ status: string; session: TableSession }>(
        {
          action: "setTableWinds",
          clubId,
          tableNumber,
          starterPlayerId,
        },
      );
      acceptServerSession(result.session);
      setRestartPromptOpen(false);
      play("confirmation");
    } catch (nextError) {
      play("error");
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to set the starting East seat.",
      );
    } finally {
      setBusy(false);
    }
  };

  const clearWinds = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await tableAction<{ status: string; session: TableSession }>(
        {
          action: "setTableWinds",
          clubId,
          tableNumber,
          clear: true,
        },
      );
      acceptServerSession(result.session);
      setRestartPromptOpen(false);
      setSettingsOpen(false);
      setWindAdjustOpen(false);
    } catch (nextError) {
      play("error");
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to restart winds.",
      );
    } finally {
      setBusy(false);
    }
  };

  const patchWinds = async (patch: {
    roundWind?: Wind;
    dealerPlayerId?: string;
    handNumber?: number;
  }) => {
    if (!windState) return;
    setBusy(true);
    setError(null);
    try {
      const result = await tableAction<{ status: string; session: TableSession }>(
        {
          action: "setTableWinds",
          clubId,
          tableNumber,
          patch,
        },
      );
      acceptServerSession(result.session);
      play("confirmation");
      setToast("Table winds updated.");
    } catch (nextError) {
      play("error");
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to update table winds.",
      );
    } finally {
      setBusy(false);
    }
  };

  const finishWindRotation = useCallback(() => {
    const nextWind = pendingWindRef.current;
    const celebration = pendingCelebrationRef.current;
    const stashed = pendingPostRotateSessionRef.current;
    pendingWindRef.current = null;
    pendingCelebrationRef.current = null;
    pendingPostRotateSessionRef.current = null;
    windAnimatingRef.current = false;
    setWindAnimating(false);
    if (stashed) {
      showSession(stashed);
    } else if (nextWind && sessionRef.current) {
      showSession({
        ...sessionRef.current,
        tableWinds: upsertTableWind(
          sessionRef.current.tableWinds ?? {},
          String(tableNumber),
          nextWind,
        ),
      });
    }
    if (celebration) setFlash(celebration);
  }, [showSession, tableNumber]);

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
        if (layoutMode === "wind" && action === "seat") {
          const nextSeats =
            result.session.tables?.[String(tableNumber)] ?? [];
          const nextWinds = result.session.tableWinds?.[String(tableNumber)];
          if (nextSeats.filter(Boolean).length === 4 && nextWinds) {
            setRestartPromptOpen(true);
          }
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
    if ((!user && !isGuest) || occupants.length !== 4 || !session) return;
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

    const gameInput = {
      entries: Object.entries(scores).map(([playerId, score]) => ({
        playerId,
        score,
      })),
      createdBy: user?.uid ?? `guest:${clubId}:${tableNumber}`,
      seasonNumber: session.seasonNumber,
      tableId: String(tableNumber),
      winType: (draw
        ? "draw"
        : winType === "self"
          ? "self_draw"
          : "discard") as "draw" | "self_draw" | "discard",
      loserPlayerId: draw || winType === "self" ? null : loser,
      fan: draw ? null : fan,
      notes: null,
      idempotencyKey: requestKey.current,
    };
    const celebration: ScoreCelebrationResult = {
      scores,
      winner: draw ? null : winner,
    };

    // Close the sheet immediately so the table (and wind spin) is visible.
    setResultOpen(false);
    requestKey.current = "";
    play(draw ? "draw" : "win");
    setTableScores((current) => {
      const next = { ...current };
      for (const [playerId, score] of Object.entries(scores)) {
        next[playerId] = (next[playerId] ?? 0) + score;
      }
      return next;
    });

    let willRotate = false;
    if (layoutMode === "wind" && windState) {
      const computed = nextWindState({
        mode: windRotation.mode,
        outcome: gameInput.winType,
        winnerPlayerId: draw ? null : winner,
        state: windState,
        liveSeatOrder: occupants,
      });
      willRotate = computed.rotated;
      if (willRotate) {
        pendingWindRef.current = computed.state;
        pendingCelebrationRef.current = celebration;
        pendingPostRotateSessionRef.current = null;
        windAnimatingRef.current = true;
        setWindAnimating(true);
      } else {
        showSession({
          ...session,
          tableWinds: upsertTableWind(
            session.tableWinds ?? {},
            String(tableNumber),
            computed.state,
          ),
        });
        setFlash(celebration);
      }
    } else {
      setFlash(celebration);
    }

    try {
      const result = isGuest
        ? await createGuestGame(clubId, {
            ...gameInput,
            createdBy: `guest:${clubId}:${tableNumber}`,
          }).then(() => ({ status: "synced" as const }))
        : await saveGameWithOfflineSupport(clubId, gameInput);

      if (layoutMode === "wind" && windState) {
        try {
          const advanced = await tableAction<{
            status: string;
            session: TableSession;
            rotated?: boolean;
          }>({
            action: "advanceTableWinds",
            clubId,
            tableNumber,
            outcome: gameInput.winType,
            winnerPlayerId: draw ? null : winner,
            mode: windRotation.mode,
          });
          if (willRotate && windAnimatingRef.current) {
            pendingPostRotateSessionRef.current = advanced.session;
          } else {
            acceptServerSession(advanced.session);
          }
        } catch {
          /* game already saved; wind sync can retry via realtime */
        }
      }

      setScoresTick((tick) => tick + 1);
      setToast(
        result.status === "synced"
          ? draw
            ? "Draw synced."
            : "Game synced!"
          : result.status === "queued"
            ? `${draw ? "Draw" : "Game"} saved on this device. It will sync when the connection returns.`
            : `${draw ? "Draw" : "Game"} saved on this device, but syncing needs attention.`,
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to save the game.",
      );
      if (willRotate) {
        pendingWindRef.current = null;
        pendingCelebrationRef.current = null;
        pendingPostRotateSessionRef.current = null;
        windAnimatingRef.current = false;
        setWindAnimating(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeBusy(true);
    setUpgradeMessage(null);
    setError(null);
    try {
      await signInWithGoogle();
      const authUser = (await import("@/lib/firebase")).auth.currentUser;
      if (!authUser) throw new Error("Sign-in did not complete. Please try again.");
      const result = await requestToJoinClub({
        clubId,
        user: authUser,
        appUrl: window.location.origin,
      });
      if (result === "already-member") {
        clearGuestTableSession();
        setIsGuest(false);
        setUpgradeOpen(false);
        setToast("Welcome back — you are signed in as a club member.");
        await loadContext();
      } else {
        setUpgradeMessage(
          "Your join request was sent to the club manager. Keep scoring as a guest until they approve you.",
        );
        await signOut();
        setIsGuest(guestSessionMatches(clubId, tableNumber));
      }
      play("confirmation");
    } catch (nextError) {
      play("error");
      setUpgradeMessage(
        nextError instanceof Error
          ? nextError.message
          : "Unable to sign in and join this club.",
      );
    } finally {
      setUpgradeBusy(false);
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

  if (loading || !guestReady || !canAccess || !context)
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
        {isGuest ? (
          <button
            type="button"
            aria-label="Back to login"
            onClick={() => exitGuestTableToLogin()}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--line))] text-2xl"
            data-tour="guest-back-login"
          >
            ←
          </button>
        ) : (
          <Link
            href={`/club/${encodeURIComponent(clubId)}`}
            aria-label="Back to club"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--line))] text-2xl"
          >
            ←
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-[.15em] text-[rgb(var(--muted))]">
            {context.clubName}
            {isGuest ? " · Guest" : ""}
          </p>
          <h1 className="text-xl font-black text-[rgb(var(--ink))]">
            Table {tableNumber}
          </h1>
        </div>
        {!isGuest ? (
          <button
            type="button"
            onClick={() => void showQr()}
            className="min-h-11 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] px-3 text-sm font-black"
          >
            QR
          </button>
        ) : null}
        <button
          type="button"
          disabled={!session || busy}
          onClick={() =>
            window.confirm(`Clear everyone from Table ${tableNumber}?`) &&
            void mutate("clear")
          }
          aria-label="Clear table"
          className="min-h-11 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] px-3.5 text-xs sm:text-sm font-bold text-[rgb(var(--cinnabar))] hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          Clear Table
        </button>
      </header>

      {isGuest ? (
        <div className="mx-auto max-w-xl px-3 pt-3 sm:px-5">
          <button
            type="button"
            onClick={() => {
              setUpgradeMessage(null);
              setUpgradeOpen(true);
            }}
            className="w-full rounded-xl border border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo)/.08)] px-4 py-3 text-center text-sm font-bold text-[rgb(var(--ink))]"
            data-tour="guest-upgrade-cta"
          >
            Want to track your session points and more? Click here to sign in to experinece the full app.
          </button>
        </div>
      ) : null}

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
              {isGuest
                ? "Ask a club member to start a session, then refresh this table."
                : "Scan this table's QR code to check in and start one automatically."}
            </p>
            {!isGuest ? (
              <button
                onClick={() => void showQr()}
                className="mt-5 min-h-12 rounded-lg bg-[rgb(var(--bamboo))] px-5 font-black text-white"
              >
                Generate table QR
              </button>
            ) : null}
          </section>
        ) : (
          <>
            {layoutMode === "wind" && windState && occupants.length === 4 ? (
              <>
                <div className="focused-wind-status">
                  <div className="focused-wind-status-round">
                    <span className="focused-wind-status-label">Round</span>
                    <button
                      type="button"
                      disabled={busy || windAnimating}
                      onClick={() => setWindAdjustOpen(true)}
                      className="focused-wind-round-pill"
                      aria-label={`Table wind ${WIND_LABELS[windState.roundWind]}. Adjust winds.`}
                    >
                      <span className="focused-wind-round-char" aria-hidden="true">
                        <StaticMahjongTile id={windState.roundWind} size={28} />
                      </span>
                      {WIND_LABELS[windState.roundWind].toUpperCase()} ROUND
                    </button>
                    <span className="focused-wind-hand">Hand {windState.handNumber}</span>
                  </div>
                  <div className="focused-wind-status-dealer">
                    <span className="focused-wind-status-label">Dealer Seat</span>
                    <button
                      type="button"
                      disabled={busy || windAnimating}
                      onClick={() => setWindAdjustOpen(true)}
                      className="focused-wind-dealer-box"
                      aria-label={`Dealer ${dealerName ?? "unknown"}. Adjust winds.`}
                    >
                      {(dealerName ?? "—").toUpperCase()}
                    </button>
                  </div>
                </div>
                <FocusedWindLayout
                  cards={windCards}
                  animating={windAnimating}
                  onRotationComplete={finishWindRotation}
                  onSeatClick={(_playerId, _seatIndex) => setPickerOpen(true)}
                />
              </>
            ) : (
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
                      {user && info.authUid === user.uid ? (
                        <span className="mt-1 rounded-full bg-[rgb(var(--bamboo)/.12)] px-2 py-1 text-[10px] font-black uppercase text-[rgb(var(--bamboo))]">
                          You
                        </span>
                      ) : null}
                    </article>
                  );
                })}
              </section>
            )}
            <p
              className={`mt-4 rounded-lg p-3 text-center text-sm font-black ${occupants.length === 4 ? "bg-[rgb(var(--bamboo)/.12)] text-[rgb(var(--bamboo))]" : "bg-[rgb(var(--surface-2))] text-[rgb(var(--muted))]"}`}
            >
              {occupants.length === 4
                ? layoutMode === "wind" && !windState
                  ? "Choose who starts as East"
                  : "Ready to score"
                : `${occupants.length} of 4 players · add ${4 - occupants.length} more`}
            </p>
          </>
        )}
      </div>

      <footer className="focused-table-actions fixed inset-x-0 z-20 mx-auto flex max-w-xl gap-2 border-t border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={occupants.length !== 4 || busy || (layoutMode === "wind" && !windState)}
          onClick={openResults}
          className="min-h-12 flex-[1.4] rounded-lg bg-[rgb(var(--bamboo))] font-black text-white disabled:opacity-40"
        >
          + Record win
        </button>
        <button
          type="button"
          disabled={occupants.length !== 4 || busy || (layoutMode === "wind" && !windState)}
          onClick={() => {
            requestKey.current = crypto.randomUUID();
            void saveGame(true);
          }}
          className="min-h-12 flex-1 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] font-black disabled:opacity-40"
        >
          Draw
        </button>
        <button
          type="button"
          aria-label="Table view settings"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((open) => !open)}
          className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--bamboo))] text-white"
        >
          <span aria-hidden="true" className="focused-settings-glyph">
            ☰
          </span>
        </button>
      </footer>

      {pickerOpen ? (
        <div
          className="viewport-overlay fixed inset-x-0 bottom-0 top-0 z-50 flex items-end bg-black/60"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setPickerOpen(false)
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="focused-player-picker-title"
            className="playful-sheet max-h-[90dvh] w-full flex flex-col rounded-t-2xl bg-[rgb(var(--surface))]"
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
                  ref={searchInputRef}
                  aria-label="Search the club roster"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search roster…"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
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
                          if (ok) {
                            if (occupants.length + 1 >= 4) {
                              // Table is now full — close the picker
                              setPickerOpen(false);
                              setSearch("");
                            } else {
                              // Clear search and re-focus so the keyboard resets
                              // and the user can quickly find the next player
                              setSearch("");
                              setTimeout(() => searchInputRef.current?.focus(), 50);
                            }
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
            <button
              type="button"
              className="mt-2 min-h-11 w-full rounded-lg border border-[rgb(var(--line))] text-sm font-black text-[rgb(var(--ink))]"
              onClick={() => setScoreCalculatorOpen(true)}
            >
              Calculate fan
            </button>
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
                      <div className="truncate text-xs font-bold text-[rgb(var(--muted))]">
                        {info.icon} {info.displayName}
                      </div>
                      <div
                        className={`mt-1 text-lg font-black ${score > 0 ? "text-[rgb(var(--bamboo))]" : score < 0 ? "text-[rgb(var(--cinnabar))]" : "text-[rgb(var(--muted))]"}`}
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

      {upgradeOpen ? (
        <div
          className="viewport-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !upgradeBusy && setUpgradeOpen(false)
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-upgrade-title"
            className="w-full max-w-md rounded-t-2xl bg-[rgb(var(--surface))] p-5 sm:rounded-2xl"
          >
            <h2 id="guest-upgrade-title" className="text-xl font-black text-[rgb(var(--ink))]">
              Want to track your points and more?
            </h2>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Sign in with Google and join this club to unlock session point tracking, roster tools, and your personal standings.
            </p>
            {upgradeMessage ? (
              <p className="mt-3 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-3 text-sm font-bold text-[rgb(var(--ink))]" role="status">
                {upgradeMessage}
              </p>
            ) : null}
            <button
              type="button"
              disabled={upgradeBusy || signingIn}
              onClick={() => void handleUpgrade()}
              className="login-google-button mt-4"
              data-tour="guest-upgrade-google"
            >
              <Image
                className="google-mark object-contain p-[3px]"
                src="/google-g.png"
                alt=""
                width={25}
                height={25}
                aria-hidden="true"
              />
              {upgradeBusy || signingIn ? "Working…" : "Continue with Google"}
            </button>
            <button
              type="button"
              disabled={upgradeBusy}
              onClick={() => setUpgradeOpen(false)}
              className="mt-2 min-h-11 w-full rounded-lg border border-[rgb(var(--line))] font-bold text-[rgb(var(--ink))]"
            >
              Not now
            </button>
          </section>
        </div>
      ) : null}

      {scoreCalculatorOpen ? (
        <ScoreCalculatorModal
          clubId={clubId}
          scoringRules={scoringRules}
          initialSeatWind={
            windState && winner
              ? seatWindForPlayer(windState, winner, occupants) ?? undefined
              : windState?.roundWind
          }
          initialRoundWind={windState?.roundWind}
          onClose={() => setScoreCalculatorOpen(false)}
          onApplyFan={(value) => {
            setFan(value);
            setScoreCalculatorOpen(false);
          }}
        />
      ) : null}

      {starterOpen && occupants.length === 4 ? (
        <div className="viewport-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="focused-starter-title"
            className="w-full max-w-md rounded-t-2xl bg-[rgb(var(--surface))] p-5 sm:rounded-2xl"
          >
            <h2 id="focused-starter-title" className="text-xl font-black">
              Who starts as East?
            </h2>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              The starting East seat is the dealer for hand 1 of the East round.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {occupants.map((id) => {
                const info = player(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    onClick={() => void persistStarter(id)}
                    className="min-h-14 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm font-black"
                  >
                    {info.icon} {info.displayName}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {settingsOpen ? (
        <div
          className="viewport-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSettingsOpen(false)
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="focused-layout-title"
            className="w-full max-w-md rounded-t-2xl bg-[rgb(var(--surface))] p-5 sm:rounded-2xl"
          >
            <h2 id="focused-layout-title" className="text-xl font-black">
              Table view
            </h2>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[rgb(var(--line))] p-3">
              <div>
                <p className="text-sm font-black">Wind tracker</p>
                <p className="text-xs text-[rgb(var(--muted))]">
                  Default compass layout with round and seat winds
                </p>
              </div>
              <label className="focused-layout-switch">
                <span className="sr-only">Use wind tracker layout</span>
                <input
                  type="checkbox"
                  checked={layoutMode === "wind"}
                  onChange={(event) =>
                    setLayoutPreference(event.target.checked ? "wind" : "basic")
                  }
                />
                <span aria-hidden="true" />
              </label>
            </div>
            <p className="mt-2 text-xs font-bold text-[rgb(var(--muted))]">
              {layoutMode === "wind" ? "Wind view (default)" : "Basic seat grid"}
            </p>
            {layoutMode === "wind" ? (
              <>
                <button
                  type="button"
                  disabled={busy || !windState}
                  onClick={() => {
                    setSettingsOpen(false);
                    setWindAdjustOpen(true);
                  }}
                  className="mt-4 min-h-11 w-full rounded-lg border border-[rgb(var(--line))] font-bold disabled:opacity-40"
                >
                  Adjust winds…
                </button>
                <button
                  type="button"
                  disabled={busy || !windState}
                  onClick={() => void clearWinds()}
                  className="mt-2 min-h-11 w-full rounded-lg border border-[rgb(var(--line))] font-bold text-[rgb(var(--cinnabar))] disabled:opacity-40"
                >
                  Restart winds…
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="mt-2 min-h-11 w-full rounded-lg bg-[rgb(var(--bamboo))] font-black text-white"
            >
              Done
            </button>
          </section>
        </div>
      ) : null}

      {windAdjustOpen && windState && occupants.length === 4 ? (
        <div className="viewport-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="focused-wind-adjust-title"
            className="w-full max-w-md rounded-t-2xl bg-[rgb(var(--surface))] p-5 sm:rounded-2xl"
          >
            <h2 id="focused-wind-adjust-title" className="text-xl font-black">
              Adjust table winds
            </h2>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Correct the prevailing round wind or dealer without restarting the table.
            </p>

            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[rgb(var(--muted))]">
              Table wind
            </p>
            <div
              className="mt-2 grid grid-cols-4 gap-2"
              role="group"
              aria-label="Table wind"
            >
              {WINDS.map((wind) => (
                <button
                  key={wind}
                  type="button"
                  disabled={busy}
                  aria-pressed={windState.roundWind === wind}
                  onClick={() => void patchWinds({ roundWind: wind })}
                  className={`min-h-14 rounded-xl border font-black ${
                    windState.roundWind === wind
                      ? "border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo)/.12)]"
                      : "border-[rgb(var(--line))] bg-[rgb(var(--surface-2))]"
                  }`}
                >
                  <span className="mx-auto block w-fit" aria-hidden="true">
                    <StaticMahjongTile id={wind} size={36} />
                  </span>
                  <span className="mt-1 block text-[10px] uppercase tracking-wide">
                    {WIND_LABELS[wind]}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[rgb(var(--muted))]">
              Dealer (East)
            </p>
            <div
              className="mt-2 grid grid-cols-2 gap-2"
              role="group"
              aria-label="Dealer seat"
            >
              {occupants.map((playerId, seatIndex) => {
                const info = player(playerId);
                const selected = windState.dealerPlayerId === playerId;
                return (
                  <button
                    key={playerId}
                    type="button"
                    disabled={busy}
                    aria-pressed={selected}
                    onClick={() => void patchWinds({ dealerPlayerId: playerId })}
                    className={`min-h-12 rounded-xl border px-3 text-left font-bold ${
                      selected
                        ? "border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo)/.12)]"
                        : "border-[rgb(var(--line))]"
                    }`}
                  >
                    <span className="block text-[10px] uppercase tracking-wide text-[rgb(var(--muted))]">
                      Seat {seatIndex + 1}
                    </span>
                    {info.icon} {info.displayName}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setWindAdjustOpen(false)}
              className="mt-4 min-h-11 w-full rounded-lg bg-[rgb(var(--bamboo))] font-black text-white"
            >
              Done
            </button>
          </section>
        </div>
      ) : null}

      {restartPromptOpen && windState && occupants.length === 4 ? (
        <div className="viewport-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="focused-roster-wind-title"
            className="w-full max-w-md rounded-t-2xl bg-[rgb(var(--surface))] p-5 sm:rounded-2xl"
          >
            <h2 id="focused-roster-wind-title" className="text-xl font-black">
              New player added
            </h2>
            <p className="mt-2 text-sm text-[rgb(var(--muted))]">
              Keep going on{" "}
              <span className="font-black text-[rgb(var(--ink))]">
                {WIND_LABELS[windState.roundWind]} round · Hand{" "}
                {windState.handNumber}
              </span>
              , or reset to East and choose a new dealer.
            </p>
            <button
              type="button"
              onClick={() => setRestartPromptOpen(false)}
              className="mt-4 min-h-11 w-full rounded-lg bg-[rgb(var(--bamboo))] font-black text-white"
            >
              Continue this hand
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void clearWinds()}
              className="mt-2 min-h-11 w-full rounded-lg border border-[rgb(var(--line))] font-bold"
            >
              Choose new dealer · reset to East
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
