'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { loadAnalyticsGames, loadAnalyticsSkillEvents } from '@/lib/data'
import type { GameDoc, PlayerDoc, PlayerStatsDoc, SkillEventDoc } from '@/lib/types'
import AnalyticsPanel from '@/components/AnalyticsPanel'
import { aggregatePlayerGames, combinedCompetitionSkillEvents, competitionRanks, defaultComparedPlayerIds, gameDate, playerCompetitionRecords, toggleComparedPlayerId } from '@/lib/standings-analytics'
import { allSessionWindow, dateIsInSessionWindow, type SessionPointWindow } from '@/lib/session-point-window'
import { useFloatingSessionTracker } from '@/contexts/FloatingSessionTrackerContext'

const PALETTE = ['#18694f', '#b9392c', '#c18b30', '#28666e', '#744c24', '#8c3f65', '#4f772d', '#264653']

function signed(value: number) { return value > 0 ? `+${value}` : String(value) }
function shortDate(date: Date) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date) }
function downsampleRows<T>(rows: T[], maximum = 240) {
  if (rows.length <= maximum) return rows
  const last = rows.length - 1
  return Array.from({ length: maximum }, (_, index) => rows[Math.round((index * last) / (maximum - 1))])
}
function playerPointRows(games: GameDoc[], playerId: string) {
  let runningPoints = 0
  return games.map((game) => {
    runningPoints +=
      game.entries.find((entry) => entry.playerId === playerId)?.score ?? 0
    return { date: shortDate(gameDate(game)), points: runningPoints }
  })
}

export default function DashboardContent({
  clubId,
  clubName,
  seasonNumber,
  initialPlayerId,
  linkedPlayerId,
  analyticsWindow,
  players,
  stats,
  statsReady,
}: {
  clubId: string
  clubName: string
  seasonNumber?: number
  initialPlayerId?: string | null
  linkedPlayerId?: string | null
  analyticsWindow: SessionPointWindow
  players: PlayerDoc[]
  stats: PlayerStatsDoc[]
  statsReady: boolean
}) {
  const [page, setPage] = useState<'club' | 'player'>(initialPlayerId ? 'player' : 'club')
  const [loadedGames, setLoadedGames] = useState<GameDoc[]>([])
  const [loadedSkillEvents, setLoadedSkillEvents] = useState<SkillEventDoc[]>([])
  const [recordGames, setRecordGames] = useState<GameDoc[]>([])
  const [recordSkillEvents, setRecordSkillEvents] = useState<SkillEventDoc[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState(initialPlayerId ?? '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [clubVisual, setClubVisual] = useState<'points' | 'skill' | 'comparison'>('points')
  const [comparedPlayerIds, setComparedPlayerIds] = useState<string[]>([])
  const [playerSearch, setPlayerSearch] = useState('')
  const comparisonInitialized = useRef(false)
  const statsUpdatedKey = stats.map((stat) => [
    stat.playerId,
    stat.updatedAt?.toMillis?.() ?? 0,
    stat.totalPoints,
    stat.gamesPlayed,
    stat.skillRating,
  ].join(':')).sort().join(',')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    const gamesPromise = loadAnalyticsGames(clubId, seasonNumber == null ? allSessionWindow() : analyticsWindow, seasonNumber)
    const eventsPromise = seasonNumber == null
      ? Promise.resolve([] as SkillEventDoc[])
      : loadAnalyticsSkillEvents(clubId, analyticsWindow, seasonNumber)
    void Promise.all([gamesPromise, eventsPromise])
      .then(([value, events]) => { if (!cancelled) { setLoadedGames(value); setLoadedSkillEvents(seasonNumber == null ? combinedCompetitionSkillEvents(value) : events) } })
      .catch((nextError) => { if (!cancelled) setError(nextError instanceof Error ? nextError.message : 'Unable to load analytics.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [analyticsWindow, clubId, seasonNumber, statsUpdatedKey])
  useEffect(() => {
    let cancelled = false
    setRecordsLoading(true); setRecordsError(null)
    const allTime = allSessionWindow()
    const gamesPromise = loadAnalyticsGames(clubId, allTime, seasonNumber)
    const eventsPromise = seasonNumber == null
      ? Promise.resolve([] as SkillEventDoc[])
      : loadAnalyticsSkillEvents(clubId, allTime, seasonNumber)
    void Promise.all([gamesPromise, eventsPromise])
      .then(([value, events]) => { if (!cancelled) { setRecordGames(value); setRecordSkillEvents(seasonNumber == null ? combinedCompetitionSkillEvents(value) : events) } })
      .catch((nextError) => { if (!cancelled) setRecordsError(nextError instanceof Error ? nextError.message : 'Unable to load player records.') })
      .finally(() => { if (!cancelled) setRecordsLoading(false) })
    return () => { cancelled = true }
  }, [clubId, seasonNumber, statsUpdatedKey])
  useEffect(() => {
    if (initialPlayerId) { setSelectedPlayerId(initialPlayerId); setPage('player') }
  }, [initialPlayerId])
  useEffect(() => {
    if (!selectedPlayerId && players[0]) setSelectedPlayerId(players[0].id)
  }, [players, selectedPlayerId])
  useEffect(() => {
    if (comparisonInitialized.current || !players.length || !statsReady) return
    comparisonInitialized.current = true
    setComparedPlayerIds(defaultComparedPlayerIds(players, stats, linkedPlayerId ?? null))
  }, [linkedPlayerId, players, stats, statsReady])

  const games = useMemo(() => {
    const now = new Date()
    return loadedGames.filter((game) => dateIsInSessionWindow(gameDate(game), analyticsWindow, now))
  }, [analyticsWindow, loadedGames])
  const skillEvents = useMemo(() => {
    const now = new Date()
    return loadedSkillEvents.filter((event) => dateIsInSessionWindow(event.datetime.toDate(), analyticsWindow, now))
  }, [analyticsWindow, loadedSkillEvents])
  const aggregate = useMemo(() => aggregatePlayerGames(games, 20), [games])
  const windowedStats = useMemo(() => {
    const rows = stats.map((stat) => {
      const gameStats = aggregate.get(stat.playerId)
      const playerEvents = skillEvents
        .filter((event) => event.playerId === stat.playerId)
        .sort((left, right) => left.datetime.toMillis() - right.datetime.toMillis())
      const playerScores = games.flatMap((game) => game.entries.filter((entry) => entry.playerId === stat.playerId).map((entry) => entry.score))
      const latestEvent = playerEvents.at(-1)
      return {
        ...stat,
        totalPoints: gameStats?.totalPoints ?? 0,
        gamesPlayed: gameStats?.gamesPlayed ?? 0,
        gamesWon: gameStats?.gamesWon ?? 0,
        gamesLost: gameStats?.gamesLost ?? 0,
        winLossRatio: gameStats?.gamesPlayed ? gameStats.gamesWon / gameStats.gamesPlayed : 0,
        bestSingleGame: playerScores.length ? Math.max(...playerScores) : Number.NEGATIVE_INFINITY,
        worstSingleGame: playerScores.length ? Math.min(...playerScores) : Number.POSITIVE_INFINITY,
        skillRating: latestEvent?.ratingAfter ?? 0,
        skillPeak: playerEvents.length ? Math.max(...playerEvents.map((event) => event.ratingAfter)) : 0,
        skillGamesPlayed: playerEvents.length,
        last5SkillDelta: playerEvents.slice(-5).reduce((sum, event) => sum + event.delta, 0),
      }
    })
    const activeRows = rows.filter((row) => row.gamesPlayed > 0 || row.skillGamesPlayed > 0)
    const pointsRanks = competitionRanks(activeRows, (row) => row.totalPoints)
    const skillRanks = competitionRanks(activeRows, (row) => row.skillRating)
    return activeRows.map((row) => ({
      ...row,
      pointsRank: pointsRanks.get(row) ?? 0,
      skillRank: skillRanks.get(row) ?? 0,
    }))
  }, [aggregate, games, skillEvents, stats])
  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? null
  const selectedStats = windowedStats.find((stat) => stat.playerId === selectedPlayerId) ?? null
  const playerGames = useMemo(() => games.filter((game) => game.entries.some((entry) => entry.playerId === selectedPlayerId)).sort((a, b) => gameDate(a).getTime() - gameDate(b).getTime()), [games, selectedPlayerId])
  const playerAggregate = aggregate.get(selectedPlayerId)
  const playerRecords = useMemo(
    () => playerCompetitionRecords(recordGames, recordSkillEvents, selectedPlayerId),
    [recordGames, recordSkillEvents, selectedPlayerId],
  )
  const playerTrend = useMemo(() => {
    return downsampleRows(playerPointRows(playerGames, selectedPlayerId))
  }, [playerGames, selectedPlayerId])
  const activePlayers = [...aggregate.values()].filter((row) => row.gamesPlayed > 0).length
  const decisiveGames = games.filter((game) => game.winType !== 'draw').length
  const totalPointsMoved = games.reduce((sum, game) => sum + game.entries.filter((entry) => entry.score > 0).reduce((inner, entry) => inner + entry.score, 0), 0)
  const comparedPlayers = comparedPlayerIds.map((id) => players.find((player) => player.id === id)).filter((player): player is PlayerDoc => Boolean(player))
  const searchedComparisonPlayers = useMemo(() => {
    const search = playerSearch.trim().toLocaleLowerCase()
    return players.filter((player) => !search || player.displayName.toLocaleLowerCase().includes(search))
  }, [playerSearch, players])
  const cumulativeScores = useMemo(() => {
    const ordered = [...games].sort((a, b) => gameDate(a).getTime() - gameDate(b).getTime())
    const running = new Map(comparedPlayerIds.map((id) => [id, 0]))
    return downsampleRows(ordered.map((game) => {
      game.entries.forEach((entry) => {
        if (running.has(entry.playerId))
          running.set(entry.playerId, (running.get(entry.playerId) ?? 0) + entry.score)
      })
      const row: Record<string, string | number> = { date: shortDate(gameDate(game)) }
      comparedPlayerIds.forEach((id) => { row[id] = running.get(id) ?? 0 })
      return row
    }))
  }, [comparedPlayerIds, games])
  const skillRanks = useMemo(() => {
    const orderedGames = [...games].sort((a, b) => gameDate(a).getTime() - gameDate(b).getTime())
    const eventsByGame = new Map<string, SkillEventDoc[]>()
    skillEvents.forEach((event) => eventsByGame.set(event.gameId, [...(eventsByGame.get(event.gameId) ?? []), event]))
    const latest = new Map<string, number>()
    return downsampleRows(orderedGames.map((game) => {
      ;(eventsByGame.get(game.id) ?? []).forEach((event) => latest.set(event.playerId, event.ratingAfter))
      const ranks = new Map([...latest].sort((a, b) => b[1] - a[1]).map(([id], rank) => [id, rank + 1]))
      const row: Record<string, string | number> = { date: shortDate(gameDate(game)) }
      comparedPlayerIds.forEach((id) => { if (ranks.has(id)) row[id] = ranks.get(id)! })
      return row
    }))
  }, [comparedPlayerIds, games, skillEvents])

  return (
    <div className="space-y-5" aria-busy={loading || recordsLoading}>
      <nav className="inline-flex rounded-lg border border-slate-300 bg-white p-1" aria-label="Analytics pages">
        <button type="button" onClick={() => setPage('club')} aria-current={page === 'club' ? 'page' : undefined} className={`rounded-md px-4 py-2 text-sm font-black ${page === 'club' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Club overview</button>
        <button type="button" onClick={() => setPage('player')} aria-current={page === 'player' ? 'page' : undefined} className={`rounded-md px-4 py-2 text-sm font-black ${page === 'player' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>Player deep dive</button>
      </nav>

      {error ? <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}

      {page === 'club' ? <>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Club pulse</p><h2 className="mt-2 text-xl font-black text-slate-950">A focused view of play volume</h2><p className="mt-1 text-sm text-slate-500">Season activity and outcomes without the dashboard overload.</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Games recorded" value={games.length} detail={`${decisiveGames} decisive · ${games.length - decisiveGames} draws`} />
            <Metric label="Players involved" value={activePlayers} detail={`Across ${players.length} roster players`} />
            <Metric label="Points exchanged" value={totalPointsMoved.toLocaleString()} detail="Positive points awarded" />
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Performance visuals</p><h3 className="mt-1 text-lg font-black text-slate-950">The familiar charts, one at a time</h3><p className="mt-1 text-sm text-slate-500">Switch views to keep the page focused while preserving score, Skill, and comparison context.</p></div>
            <div className="inline-flex self-start rounded-lg border border-slate-300 bg-slate-50 p-1" role="group" aria-label="Club visualization">
              {([['points', 'Score history'], ['skill', 'Skill ranks'], ['comparison', 'Player comparison']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setClubVisual(value)} aria-pressed={clubVisual === value} className={`rounded-md px-3 py-2 text-xs font-black ${clubVisual === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}
            </div>
          </div>
          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-black text-slate-700">Players shown · {comparedPlayers.length}/5</summary>
            <div className="border-t border-slate-200 p-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="search" value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Search players…" aria-label="Search comparison players" className="min-h-10 min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900" />
                <button type="button" onClick={() => setComparedPlayerIds([])} disabled={!comparedPlayerIds.length} className="min-h-10 rounded border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 disabled:opacity-40">Clear all</button>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">Choose up to 5 players. The default includes your linked player and the strongest current Skill ratings.</p>
              <div className="mt-2 grid max-h-44 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {searchedComparisonPlayers.map((player) => { const checked = comparedPlayerIds.includes(player.id); const atLimit = comparedPlayerIds.length >= 5; return <label key={player.id} className={`flex min-h-10 items-center gap-2 rounded px-3 text-sm font-bold ${checked ? 'cursor-pointer bg-emerald-700 text-white' : atLimit ? 'cursor-not-allowed bg-white text-slate-400' : 'cursor-pointer bg-white text-slate-700'}`}><input type="checkbox" checked={checked} disabled={!checked && atLimit} onChange={() => setComparedPlayerIds((current) => toggleComparedPlayerId(current, player.id))} /> {player.icon} <span className="truncate">{player.displayName}</span></label> })}
                {!searchedComparisonPlayers.length ? <p className="p-3 text-sm font-semibold text-slate-500">No players match that search.</p> : null}
              </div>
            </div>
          </details>
          {comparedPlayers.length ? <div className="mt-4 flex flex-wrap gap-3">{comparedPlayers.map((player, index) => <span key={player.id} className="flex items-center gap-2 text-xs font-bold text-slate-600"><i className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[index % PALETTE.length] }} />{player.icon} {player.displayName}</span>)}</div> : null}
          {clubVisual === 'points' ? <ComparisonLineChart data={cumulativeScores} players={comparedPlayers} label="Cumulative score history" /> : null}
          {clubVisual === 'skill' ? <ComparisonLineChart data={skillRanks} players={comparedPlayers} label="Skill rank history" reversed /> : null}
          {clubVisual === 'comparison' ? <div className="mt-4"><AnalyticsPanel playerStats={windowedStats} players={players} selectedPlayerIds={comparedPlayerIds} /></div> : null}
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-black text-slate-900">Leaders in this window</h3><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{windowedStats.filter((stat) => stat.gamesPlayed > 0).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 6).map((stat, index) => { const player = players.find((item) => item.id === stat.playerId); return <button type="button" key={stat.playerId} onClick={() => { setSelectedPlayerId(stat.playerId); setPage('player') }} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:border-emerald-400"><span><strong className="block text-sm">#{index + 1} {player?.icon} {player?.displayName ?? stat.playerId}</strong><span className="text-xs text-slate-500">Open player analytics</span></span><strong className="font-mono">{signed(stat.totalPoints)}</strong></button> })}</div>{!windowedStats.some((stat) => stat.gamesPlayed > 0) ? <p className="mt-4 rounded border border-dashed p-6 text-center text-sm font-semibold text-slate-500">No games were played in this window.</p> : null}</section>
      </> : <>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><label className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Player<select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)} className="mt-2 block min-h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm font-bold normal-case tracking-normal text-slate-900">{players.map((player) => <option key={player.id} value={player.id}>{player.icon} {player.displayName}</option>)}</select></label></section>
        {selectedPlayer ? <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="text-3xl">{selectedPlayer.icon}</span><div><p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Player report</p><h2 className="text-xl font-black text-slate-950">{selectedPlayer.displayName}</h2></div></div><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Points" value={signed(playerAggregate?.totalPoints ?? 0)} detail={`${playerAggregate?.gamesPlayed ?? 0} games in view`} /><Metric label="Win rate" value={`${Math.round(((playerAggregate?.gamesWon ?? 0) / Math.max(1, playerAggregate?.gamesPlayed ?? 0)) * 100)}%`} detail={`${playerAggregate?.gamesWon ?? 0} wins`} /><Metric label="Skill" value={selectedStats?.skillGamesPlayed ? selectedStats.skillRating : '—'} detail={selectedStats?.skillGamesPlayed ? `Rank #${selectedStats.skillRank}` : 'No Skill activity in view'} /><Metric label="Best game" value={Number.isFinite(selectedStats?.bestSingleGame) ? signed(selectedStats?.bestSingleGame ?? 0) : '—'} detail={`Peak Skill ${selectedStats?.skillGamesPlayed ? selectedStats.skillPeak : '—'}`} /></div></section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Competition records</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">All-time highs and lows</h3>
            <p className="mt-1 text-sm text-slate-500">{seasonNumber == null ? 'Across every recorded game in all seasons and tournaments.' : 'Across every recorded game in this Season or Tournament.'} These records do not change with the date filter.</p>
            {recordsError ? <p role="alert" className="mt-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{recordsError}</p> : null}
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <Metric label="Max ever points" value={recordsLoading ? '…' : playerRecords.maximumCumulativePoints == null ? '—' : signed(playerRecords.maximumCumulativePoints)} detail="Highest cumulative total" />
              <Metric label="Lowest ever points" value={recordsLoading ? '…' : playerRecords.minimumCumulativePoints == null ? '—' : signed(playerRecords.minimumCumulativePoints)} detail="Lowest cumulative total" />
              <Metric label="Highest single-game win" value={recordsLoading ? '…' : playerRecords.highestSingleGameWin == null ? '—' : signed(playerRecords.highestSingleGameWin)} detail="Best positive result" />
              <Metric label="Worst single-game loss" value={recordsLoading ? '…' : playerRecords.worstSingleGameLoss == null ? '—' : signed(playerRecords.worstSingleGameLoss)} detail="Largest negative result" />
              <Metric label="Peak Skill score" value={recordsLoading ? '…' : playerRecords.peakSkillRating ?? '—'} detail="Highest recorded rating" />
              <Metric label="Lowest Skill score" value={recordsLoading ? '…' : playerRecords.lowestSkillRating ?? '—'} detail="Lowest recorded rating" />
            </div>
          </section>
          <section className="grid gap-5 lg:grid-cols-[1.45fr_.8fr]"><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-black text-slate-900">Point progression</h3><p className="mt-1 text-sm text-slate-500">Running form across the selected time window.</p><Chart data={playerTrend} dataKey="points" empty="No games for this player in the selected window." /></div><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-black text-slate-900">How wins happen</h3><div className="mt-4 space-y-3"><WinType label="Self-drawn wins" value={playerAggregate?.selfDrawWins ?? 0} total={playerAggregate?.gamesWon ?? 0} color="bg-emerald-600" /><WinType label="Discard wins" value={playerAggregate?.discardWins ?? 0} total={playerAggregate?.gamesWon ?? 0} color="bg-indigo-600" /><WinType label="Drawn games" value={playerAggregate?.draws ?? 0} total={playerAggregate?.gamesPlayed ?? 0} color="bg-slate-400" /></div></div></section>
          <EmbeddedSessionTracker clubId={clubId} clubName={clubName} player={selectedPlayer} window={analyticsWindow} games={playerGames} players={players} />
        </> : <p className="rounded border border-dashed p-8 text-center text-sm text-slate-500">Choose a player to begin.</p>}
      </>}
    </div>
  )
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <article className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p></article> }
function ComparisonLineChart({ data, players, label, reversed = false }: { data: Array<Record<string, string | number>>; players: PlayerDoc[]; label: string; reversed?: boolean }) { return data.length && players.length ? <div className="mt-4 h-72" role="img" aria-label={label}><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={.2}/><XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28}/><YAxis reversed={reversed} allowDecimals={false} tick={{ fontSize: 11 }}/><Tooltip/>{players.map((player, index) => <Line key={player.id} type="monotone" dataKey={player.id} name={player.displayName} stroke={PALETTE[index % PALETTE.length]} strokeWidth={2.5} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></div> : <p className="mt-4 rounded border border-dashed p-10 text-center text-sm text-slate-500">Select players with recorded games to draw this chart.</p> }
function Chart({ data, dataKey, secondaryKey, empty }: { data: Array<Record<string, string | number>>; dataKey: string; secondaryKey?: string; empty: string }) { return data.length ? <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16805d" stopOpacity={.3}/><stop offset="95%" stopColor="#16805d" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={.2}/><XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={28}/><YAxis tick={{ fontSize: 11 }}/><Tooltip/><Area type="monotone" dataKey={dataKey} stroke="#16805d" strokeWidth={3} fill={`url(#fill-${dataKey})`} />{secondaryKey ? <Area type="monotone" dataKey={secondaryKey} stroke="#4f46e5" strokeWidth={2} fill="none" /> : null}</AreaChart></ResponsiveContainer></div> : <p className="mt-4 rounded border border-dashed p-10 text-center text-sm text-slate-500">{empty}</p> }
function WinType({ label, value, total, color }: { label: string; value: number; total: number; color: string }) { const percent = Math.round((value / Math.max(1, total)) * 100); return <div><div className="flex justify-between text-sm font-bold"><span>{label}</span><span>{value} · {percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div></div> }

function EmbeddedSessionTracker({ clubId, clubName, player, window, games, players }: { clubId: string; clubName: string; player: PlayerDoc; window: SessionPointWindow; games: GameDoc[]; players: PlayerDoc[] }) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const { enableFloat, isFloatingFor } = useFloatingSessionTracker()
  const playerNames = useMemo(() => new Map(players.map((item) => [item.id, item.displayName])), [players])
  const totalPoints = useMemo(() => games.reduce((sum, game) => sum + (game.entries.find((entry) => entry.playerId === player.id)?.score ?? 0), 0), [games, player.id])
  const breakdown = useMemo(() => [...games].reverse().map((game) => ({
    gameId: game.id,
    playedAt: gameDate(game),
    score: game.entries.find((entry) => entry.playerId === player.id)?.score ?? 0,
    winType: game.winType,
    opponents: game.entries.filter((entry) => entry.playerId !== player.id).map((entry) => playerNames.get(entry.playerId) ?? entry.playerId).sort().join(', '),
  })), [games, player.id, playerNames])
  const floating = isFloatingFor(clubId, player.id, window)

  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-amber-700">Session tracker</p><h3 className="mt-1 text-lg font-black text-slate-950">Window net change</h3><p className="mt-1 text-sm text-slate-500">Uses the same time window selected in the analytics header.</p></div><button type="button" onClick={() => enableFloat({ clubId, clubName, playerId: player.id, playerName: player.displayName, playerIcon: player.icon, window })} className={`min-h-10 rounded border px-3 text-sm font-bold ${floating ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-slate-700'}`}>{floating ? 'Floating' : 'Float tracker'}</button></div>
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center"><p className="text-sm font-bold text-slate-600">{player.icon} {player.displayName}</p><p className={`mt-2 text-4xl font-black ${totalPoints > 0 ? 'text-emerald-700' : totalPoints < 0 ? 'text-rose-700' : 'text-slate-700'}`}>{signed(totalPoints)}</p><p className="mt-1 text-xs font-semibold text-slate-500">net points · {games.length} games</p><button type="button" onClick={() => setShowBreakdown((value) => !value)} className="mt-3 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold">{showBreakdown ? 'Hide game breakdown' : 'View game breakdown'}</button></div>
    {showBreakdown ? <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Opponents</th><th className="px-3 py-2 text-right">Change</th></tr></thead><tbody>{breakdown.map((game) => <tr key={game.gameId} className="border-t"><td className="whitespace-nowrap px-3 py-2">{game.playedAt.toLocaleString()}</td><td className="px-3 py-2">{game.winType === 'self_draw' ? 'Self-draw' : game.winType === 'discard' ? 'Discard' : 'Draw'}</td><td className="px-3 py-2">{game.opponents || '—'}</td><td className="px-3 py-2 text-right font-bold">{signed(game.score)}</td></tr>)}</tbody></table>{!breakdown.length ? <p className="p-5 text-center text-sm text-slate-500">No games in this window.</p> : null}</div> : null}
  </section>
}
