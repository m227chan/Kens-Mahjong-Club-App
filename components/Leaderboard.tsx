'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadGamesInDateRange, subscribePlayerStats, subscribePlayers } from '@/lib/data'
import type { GameDoc, PlayerDoc, PlayerStatsDoc } from '@/lib/types'
import { titleForStanding } from '@/lib/players'
import { DEFAULT_TITLE_RULES, type TitleRules } from '@/lib/title-rules'
import { aggregatePlayerGames, boundsForPreset, competitionRanks, gamesInBounds, subtractCalendarMonths, type StandingsDatePreset } from '@/lib/standings-analytics'
import ViewHeader from '@/components/ViewHeader'

type SortKey = 'rank' | 'name' | 'points' | 'skill' | 'games' | 'wins' | 'losses' | 'winRate'
type SortDirection = 'asc' | 'desc'

function formatWinRate(wins: number, games: number) {
  return games ? `${Math.round((wins / games) * 100)}%` : '0%'
}

function Sparkline({ values }: { values: number[] }) {
  const width = 84
  const height = 30
  const points = values.length === 1 ? [values[0], values[0]] : values
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const path = points.map((value, index) => `${(index / Math.max(1, points.length - 1)) * width},${height - 2 - ((value - min) / span) * (height - 4)}`).join(' ')
  const positive = (values.at(-1) ?? 0) >= (values[0] ?? 0)
  return values.length ? (
    <svg viewBox={`0 0 ${width} ${height}`} className={`h-8 w-[72px] max-w-full ${positive ? 'text-emerald-600' : 'text-rose-600'}`} role="img" aria-label={`Last ${values.length} game trend moved from ${values[0]} to ${values.at(-1)}`}>
      <polyline points={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : <span className="text-xs text-slate-400">No trend</span>
}

export function LeaderboardPanel({
  clubId,
  seasonNumber,
  compact = false,
  players: suppliedPlayers,
  stats: suppliedStats,
  titleRules = DEFAULT_TITLE_RULES,
  activePlayerMonths = 3,
  onPlayerAnalytics,
}: {
  clubId: string
  seasonNumber?: number
  scopeLabel?: string
  compact?: boolean
  players?: PlayerDoc[]
  stats?: PlayerStatsDoc[]
  titleRules?: TitleRules
  activePlayerMonths?: number
  onPlayerAnalytics?: (playerId: string) => void
}) {
  const [subscribedPlayers, setSubscribedPlayers] = useState<PlayerDoc[]>([])
  const [subscribedStats, setSubscribedStats] = useState<PlayerStatsDoc[]>([])
  const [games, setGames] = useState<GameDoc[]>([])
  const [, setGamesLoading] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('points')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [nameFilter, setNameFilter] = useState('')
  const [minimumGames, setMinimumGames] = useState('')
  const [activeOnly, setActiveOnly] = useState(true)
  const [preset, setPreset] = useState<StandingsDatePreset>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const players = suppliedPlayers ?? subscribedPlayers
  const stats = suppliedStats ?? subscribedStats
  const statsUpdatedKey = stats.map((stat) => stat.updatedAt?.toMillis?.() ?? 0).sort().join(',')
  const combinedCompetitions = seasonNumber == null

  useEffect(() => suppliedPlayers ? undefined : subscribePlayers(clubId, setSubscribedPlayers), [clubId, suppliedPlayers])
  useEffect(() => suppliedStats ? undefined : subscribePlayerStats(clubId, setSubscribedStats, seasonNumber), [clubId, seasonNumber, suppliedStats])
  useEffect(() => setActiveOnly(!combinedCompetitions), [combinedCompetitions])
  useEffect(() => {
    if (preset === 'all') {
      setGames([])
      setGamesLoading(false)
      return
    }
    let cancelled = false
    setGamesLoading(true)
    const bounds = boundsForPreset(preset, new Date(), customStart, customEnd)
    void loadGamesInDateRange(clubId, bounds.start, bounds.end, seasonNumber).then((value) => { if (!cancelled) setGames(value) }).finally(() => { if (!cancelled) setGamesLoading(false) })
    return () => { cancelled = true }
  }, [clubId, customEnd, customStart, preset, seasonNumber, statsUpdatedKey])

  const seasonGames = useMemo(() => games.filter((game) => !seasonNumber || game.seasonNumber === seasonNumber), [games, seasonNumber])
  const boundedGames = useMemo(() => gamesInBounds(seasonGames, boundsForPreset(preset, new Date(), customStart, customEnd)), [customEnd, customStart, preset, seasonGames])
  const aggregate = useMemo(() => aggregatePlayerGames(boundedGames), [boundedGames])
  const activeIds = useMemo(() => {
    const cutoff = subtractCalendarMonths(new Date(), activePlayerMonths).getTime()
    return new Set(stats.filter((stat) => stat.lastPlayedAt && new Date(`${stat.lastPlayedAt}T23:59:59.999`).getTime() >= cutoff).map((stat) => stat.playerId))
  }, [activePlayerMonths, stats])
  const dateFiltered = preset !== 'all'

  const rows = useMemo(() => {
    const base = stats.map((stat) => {
      const player = players.find((item) => item.id === stat.playerId)
      const period = aggregate.get(stat.playerId)
      return {
        ...stat,
        totalPoints: dateFiltered ? period?.totalPoints ?? 0 : stat.totalPoints,
        gamesPlayed: dateFiltered ? period?.gamesPlayed ?? 0 : stat.gamesPlayed,
        gamesWon: dateFiltered ? period?.gamesWon ?? 0 : stat.gamesWon,
        gamesLost: dateFiltered ? period?.gamesLost ?? 0 : stat.gamesLost,
        pointTrend: dateFiltered ? period?.pointTrend ?? [] : stat.recentPointTrend ?? [],
        displayName: player?.displayName ?? stat.playerId,
        icon: player?.icon ?? '🀄',
      }
    }).filter((row) => !dateFiltered || row.gamesPlayed > 0)
      .filter((row) => !activeOnly || activeIds.has(row.playerId))
    const ranks = competitionRanks(base, (row) => row.totalPoints)
    const direction = sortDirection === 'asc' ? 1 : -1
    const value = (row: typeof base[number]) => {
      if (sortKey === 'rank') return ranks.get(row) ?? Number.MAX_SAFE_INTEGER
      if (sortKey === 'name') return row.displayName.toLocaleLowerCase()
      if (sortKey === 'points') return row.totalPoints
      if (sortKey === 'skill') return row.skillRating
      if (sortKey === 'games') return row.gamesPlayed
      if (sortKey === 'wins') return row.gamesWon
      if (sortKey === 'losses') return row.gamesLost
      return row.gamesPlayed ? row.gamesWon / row.gamesPlayed : 0
    }
    return base.map((row) => ({ ...row, visibleRank: ranks.get(row) ?? 0 }))
      .filter((row) => row.displayName.toLocaleLowerCase().includes(nameFilter.trim().toLocaleLowerCase()))
      .filter((row) => !minimumGames || row.gamesPlayed >= Number(minimumGames))
      .sort((a, b) => {
        const left = value(a), right = value(b)
        const result = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : Number(left) - Number(right)
        return result * direction || a.playerId.localeCompare(b.playerId)
      })
  }, [activeIds, activeOnly, aggregate, dateFiltered, minimumGames, nameFilter, players, sortDirection, sortKey, stats])

  const setSort = (key: SortKey) => {
    if (key === sortKey) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDirection(key === 'name' || key === 'rank' ? 'asc' : 'desc') }
  }
  const visibleRows = compact ? rows.slice(0, 8) : rows
  const mobileRows = mobileExpanded ? visibleRows : visibleRows.slice(0, 5)
  const filterCount = [activeOnly, preset !== 'all', Boolean(nameFilter), Boolean(minimumGames)].filter(Boolean).length
  return (
    <section data-tour="leaderboard" className="leaderboard-board view-card overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <ViewHeader
        className="leaderboard-board-header"
        title="Leaderboard"
        action={(
          <button type="button" aria-expanded={filtersOpen} aria-label={`Filter leaderboard${filterCount ? `, ${filterCount} active` : ''}`} onClick={() => setFiltersOpen((value) => !value)} className="view-header-action">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          </button>
        )}
      />
      {filtersOpen ? <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-600">Date range<select value={preset} onChange={(event) => setPreset(event.target.value as StandingsDatePreset)} className="mt-1 min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm"><option value="all">All time</option><option value="30d">Last 30 days</option><option value="3m">Last 3 months</option><option value="ytd">Year to date</option><option value="custom">Custom dates</option></select></label>
        <label className="text-xs font-bold text-slate-600">Player<input type="search" value={nameFilter} onChange={(event) => setNameFilter(event.target.value)} placeholder="Filter names…" className="mt-1 min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm" /></label>
        <label className="text-xs font-bold text-slate-600">Minimum games<input type="number" min="0" value={minimumGames} onChange={(event) => setMinimumGames(event.target.value)} placeholder="Any" className="mt-1 min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm" /></label>
        <label className="text-xs font-bold text-slate-600">Sort<select value={sortKey} onChange={(event) => setSort(event.target.value as SortKey)} className="mt-1 min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm"><option value="points">Points</option><option value="rank">Rank</option><option value="name">Name</option><option value="skill">Skill</option><option value="games">Games</option><option value="wins">Wins</option><option value="winRate">Win ratio</option></select></label>
        <div className="text-xs font-bold text-slate-600"><span>Players shown</span><label className="mt-1 flex min-h-10 cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} className="h-4 w-4 accent-emerald-700" />Active</label></div>
        {preset === 'custom' ? <><label className="text-xs font-bold text-slate-600">From<input type="date" value={customStart} max={customEnd || undefined} onChange={(event) => setCustomStart(event.target.value)} className="mt-1 min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm" /></label><label className="text-xs font-bold text-slate-600">To<input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => setCustomEnd(event.target.value)} className="mt-1 min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm" /></label></> : null}
        <p className="self-end text-xs font-semibold leading-5 text-slate-500">Active means played within {activePlayerMonths} calendar month{activePlayerMonths === 1 ? '' : 's'}. Date filters recalculate points and results; Skill remains the {combinedCompetitions ? 'combined all-seasons' : 'selected competition’s'} current rating.</p>
        <button type="button" onClick={() => { setPreset('all'); setCustomStart(''); setCustomEnd(''); setNameFilter(''); setMinimumGames(''); setActiveOnly(!combinedCompetitions); setSortKey('points'); setSortDirection('desc') }} className="min-h-10 self-end rounded border border-slate-300 bg-white px-3 text-sm font-bold">Reset</button>
      </div> : null}

      {visibleRows.length ? <>
        <div className="md:hidden">
          <div className="grid grid-cols-[42px_minmax(0,1fr)_72px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase text-slate-500"><span>Rank</span><span>Player</span><span>Points</span></div>
          {mobileRows.map((row) => <article key={row.playerId} className="border-b border-slate-200">
            <button type="button" onClick={() => setExpandedRows((current) => ({ ...current, [row.playerId]: !current[row.playerId] }))} className="grid min-h-16 w-full grid-cols-[42px_minmax(0,1fr)_72px] items-center gap-2 px-3 text-left"><strong className="font-mono text-rose-700">#{row.visibleRank}</strong><span className="min-w-0"><span className="block truncate text-sm font-extrabold">{row.icon} {row.displayName}</span><span className="block truncate text-xs text-slate-500">{titleForStanding(row.visibleRank, rows.length, row.gamesPlayed, titleRules)}</span></span><strong className="font-mono text-sm">{row.totalPoints}</strong></button>
            {expandedRows[row.playerId] ? <div className="bg-slate-50 px-3 py-3"><div className="grid grid-cols-4 gap-2 text-center text-xs"><span>Skill<strong className="mt-1 block">{row.skillRating}</strong></span><span>Games<strong className="mt-1 block">{row.gamesPlayed}</strong></span><span>Wins<strong className="mt-1 block">{row.gamesWon}</strong></span><span>Win %<strong className="mt-1 block">{formatWinRate(row.gamesWon, row.gamesPlayed)}</strong></span></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Last 10 trend</p><Sparkline values={row.pointTrend} /></div>{onPlayerAnalytics ? <button type="button" onClick={() => onPlayerAnalytics(row.playerId)} className="rounded bg-emerald-700 px-3 py-2 text-xs font-bold text-white">See more</button> : null}</div></div> : null}
          </article>)}
          {visibleRows.length > 5 ? <button type="button" onClick={() => setMobileExpanded((value) => !value)} className="w-full px-4 py-3 text-sm font-bold text-emerald-700">{mobileExpanded ? 'Show fewer' : `Show all ${visibleRows.length} players`}</button> : null}
        </div>
        <div className="hidden overflow-x-auto md:block"><div className="min-w-[640px]" role="table" aria-label="Club leaderboard">
          <div role="row" className="grid grid-cols-[44px_minmax(128px,1.6fr)_62px_60px_50px_44px_52px_82px_34px] gap-1.5 border-b bg-slate-50 px-3 py-3 text-[10px] font-bold uppercase text-slate-500">{[['Rank','rank'],['Player','name'],['Points','points'],['Skill','skill'],['Games','games'],['Wins','wins'],['Win %','winRate']].map(([label,key]) => <button key={key} type="button" onClick={() => setSort(key as SortKey)} className="min-w-0 text-left">{label}{sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}</button>)}<span className="leading-tight">Last 10 trend</span><span aria-label="Player details" /></div>
          {visibleRows.map((row) => <div key={row.playerId} role="row" tabIndex={onPlayerAnalytics ? 0 : undefined} onClick={() => onPlayerAnalytics?.(row.playerId)} onKeyDown={(event) => { if (onPlayerAnalytics && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onPlayerAnalytics(row.playerId) } }} aria-label={onPlayerAnalytics ? `Open analytics for ${row.displayName}` : undefined} className={`leaderboard-row grid grid-cols-[44px_minmax(128px,1.6fr)_62px_60px_50px_44px_52px_82px_34px] items-center gap-1.5 border-b px-3 py-3 ${onPlayerAnalytics ? 'cursor-pointer outline-none hover:ring-1 hover:ring-inset hover:ring-emerald-400 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500' : ''}`}><strong className="text-lg text-rose-700">#{row.visibleRank}</strong><span className="min-w-0"><strong className="block break-words text-sm">{row.icon} {row.displayName}</strong><span className="block break-words text-xs text-slate-500">{titleForStanding(row.visibleRank, rows.length, row.gamesPlayed, titleRules)}</span></span><span className="min-w-0 font-mono font-bold">{row.totalPoints}</span><span className="min-w-0">{row.skillRating}</span><span className="min-w-0">{row.gamesPlayed}</span><span className="min-w-0">{row.gamesWon}</span><span className="min-w-0">{formatWinRate(row.gamesWon, row.gamesPlayed)}</span><Sparkline values={row.pointTrend} />{onPlayerAnalytics ? <span aria-hidden="true" className="text-center text-xl font-black text-emerald-700">›</span> : <span />}</div>)}
        </div></div>
      </> : <div className="px-5 py-10 text-center text-sm font-semibold text-slate-500">No players have games matching these standings filters.</div>}
    </section>
  )
}
