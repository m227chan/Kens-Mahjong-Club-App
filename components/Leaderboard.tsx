'use client'

import { useEffect, useMemo, useState } from 'react'
import { subscribePlayerStats, subscribePlayers } from '@/lib/data'
import type { PlayerDoc, PlayerStatsDoc } from '@/lib/types'
import { titleForStanding } from '@/lib/players'
import { DEFAULT_TITLE_RULES, type TitleRules } from '@/lib/title-rules'

function formatSigned(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

function formatWinRate(wins: number, games: number) {
  if (!games) return '0%'
  return `${Math.round((wins / games) * 100)}%`
}

type SortKey =
  | 'rank'
  | 'name'
  | 'points'
  | 'skill'
  | 'games'
  | 'wins'
  | 'losses'
  | 'winRate'
type SortDirection = 'asc' | 'desc'

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
}: {
  label: string
  column: SortKey
  active: SortKey
  direction: SortDirection
  onSort: (column: SortKey) => void
}) {
  const isActive = active === column
  return (
    <div
      role="columnheader"
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-pressed={isActive}
        aria-label={`Sort by ${label}${isActive ? `, currently ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
        className="group flex w-full items-center gap-1 text-left hover:text-[rgb(var(--bamboo))]"
        title={`Sort ${label}`}
      >
        <span>{label}</span>
        <span
          aria-hidden="true"
          className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          {isActive ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </div>
  )
}

export function LeaderboardPanel({
  clubId,
  seasonNumber,
  compact = false,
  players: suppliedPlayers,
  titleRules = DEFAULT_TITLE_RULES,
}: {
  clubId: string
  seasonNumber?: number
  compact?: boolean
  players?: PlayerDoc[]
  titleRules?: TitleRules
}) {
  const [subscribedPlayers, setSubscribedPlayers] = useState<PlayerDoc[]>([])
  const [stats, setStats] = useState<PlayerStatsDoc[]>([])
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [expandedMobileRows, setExpandedMobileRows] = useState<Record<string, boolean>>({})
  const [sortKey, setSortKey] = useState<SortKey>('points')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [nameFilter, setNameFilter] = useState('')
  const [minimumGames, setMinimumGames] = useState('')
  const [minimumSkill, setMinimumSkill] = useState('')
  const [pointsFilter, setPointsFilter] = useState<
    'all' | 'positive' | 'negative'
  >('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const players = suppliedPlayers ?? subscribedPlayers

  useEffect(
    () =>
      suppliedPlayers
        ? undefined
        : subscribePlayers(clubId, setSubscribedPlayers),
    [clubId, suppliedPlayers],
  )
  useEffect(
    () =>
      subscribePlayerStats(
        clubId,
        (nextStats) => setStats(nextStats),
        seasonNumber,
      ),
    [clubId, seasonNumber],
  )

  const rows = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    const valueFor = (
      row: PlayerStatsDoc & { displayName: string },
      key: SortKey,
    ): string | number => {
      if (key === 'rank') return row.pointsRank || Number.MAX_SAFE_INTEGER
      if (key === 'name') return row.displayName.toLocaleLowerCase()
      if (key === 'points') return row.totalPoints
      if (key === 'skill') return row.skillRating
      if (key === 'games') return row.gamesPlayed
      if (key === 'wins') return row.gamesWon
      if (key === 'losses') return row.gamesLost
      return row.gamesPlayed ? row.gamesWon / row.gamesPlayed : 0
    }
    return stats
      .map((entry) => {
        const player = players.find((item) => item.id === entry.playerId)
        return {
          ...entry,
          displayName: player?.displayName ?? entry.playerId,
          icon: player?.icon ?? 'M',
          title: player?.title ?? 'Player',
        }
      })
      .filter((row) =>
        row.displayName
          .toLocaleLowerCase()
          .includes(nameFilter.trim().toLocaleLowerCase()),
      )
      .filter((row) => !minimumGames || row.gamesPlayed >= Number(minimumGames))
      .filter((row) => !minimumSkill || row.skillRating >= Number(minimumSkill))
      .filter(
        (row) =>
          pointsFilter === 'all' ||
          (pointsFilter === 'positive'
            ? row.totalPoints >= 0
            : row.totalPoints < 0),
      )
      .sort((a, b) => {
        const left = valueFor(a, sortKey),
          right = valueFor(b, sortKey)
        const comparison =
          typeof left === 'string' && typeof right === 'string'
            ? left.localeCompare(right)
            : Number(left) - Number(right)
        return comparison * direction || a.playerId.localeCompare(b.playerId)
      })
  }, [
    minimumGames,
    minimumSkill,
    nameFilter,
    players,
    pointsFilter,
    sortDirection,
    sortKey,
    stats,
  ])

  const handleSort = (column: SortKey) => {
    if (sortKey === column)
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(column)
      setSortDirection(column === 'name' || column === 'rank' ? 'asc' : 'desc')
    }
  }
  const activeFilterCount = [
    Boolean(nameFilter.trim()),
    Boolean(minimumGames),
    Boolean(minimumSkill),
    pointsFilter !== 'all',
  ].filter(Boolean).length

  const visibleRows = compact ? rows.slice(0, 8) : rows
  const mobileRows = mobileExpanded ? visibleRows : visibleRows.slice(0, 5)

  return (
    <section
      data-tour="leaderboard"
      className="leaderboard-board overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header className="leaderboard-board-header border-b border-slate-200 px-5 py-4">
        <div className="leaderboard-board-header-row flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black leading-none text-slate-900">Leaderboard</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {rows.length} ranked players
            </p>
          </div>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-label={`Filter leaderboard${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
            title="Filter leaderboard"
            onClick={() => setFiltersOpen((current) => !current)}
            className={`relative grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[3px] border p-0 shadow-[2px_2px_0_rgb(var(--shadow)/.07)] transition-colors ${activeFilterCount ? 'border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo)/.10)] text-[rgb(var(--bamboo))]' : 'border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] text-[rgb(var(--ink))] hover:border-[rgb(var(--cinnabar))] hover:bg-[rgb(var(--cinnabar)/.06)] hover:text-[rgb(var(--cinnabar))]'}`}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></svg>
            {activeFilterCount ? <span aria-hidden="true" className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[rgb(var(--cinnabar))] px-1 text-[9px] font-black text-white">{activeFilterCount}</span> : null}
          </button>
        </div>
      </header>
      {filtersOpen ? (
        <div className="leaderboard-filter-grid grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Player
            <input
              type="search"
              value={nameFilter}
              onChange={(event) => setNameFilter(event.target.value)}
              placeholder="Filter names…"
              className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Minimum games
            <input
              type="number"
              min="0"
              value={minimumGames}
              onChange={(event) => setMinimumGames(event.target.value)}
              placeholder="Any"
              className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Minimum Skill
            <input
              type="number"
              value={minimumSkill}
              onChange={(event) => setMinimumSkill(event.target.value)}
              placeholder="Any"
              className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Points
            <select
              value={pointsFilter}
              onChange={(event) =>
                setPointsFilter(event.target.value as typeof pointsFilter)
              }
              className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
            >
              <option value="all">All</option>
              <option value="positive">Zero or above</option>
              <option value="negative">Below zero</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Sort by
            <select
              value={sortKey}
              onChange={(event) => handleSort(event.target.value as SortKey)}
              className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
            >
              <option value="rank">Rank</option>
              <option value="name">Name</option>
              <option value="points">Points</option>
              <option value="skill">Skill</option>
              <option value="games">Games</option>
              <option value="wins">Wins</option>
              <option value="losses">Losses</option>
              <option value="winRate">Win ratio</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Direction
            <select
              value={sortDirection}
              onChange={(event) =>
                setSortDirection(event.target.value as SortDirection)
              }
              className="mt-1 block min-h-10 w-full rounded border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setNameFilter('')
              setMinimumGames('')
              setMinimumSkill('')
              setPointsFilter('all')
              setSortKey('points')
              setSortDirection('desc')
            }}
            className="min-h-10 self-end rounded border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700"
          >
            Reset filters
          </button>
        </div>
      ) : null}

      {visibleRows.length > 0 ? (
        <>
          <div className="mobile-leaderboard md:hidden">
            <div className="grid grid-cols-[42px_minmax(0,1fr)_76px] items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
              <span>Rank</span>
              <span>Player</span>
              <span>Points</span>
            </div>
            <div className="divide-y divide-slate-200">
              {mobileRows.map((row, index) => (
                <article key={row.playerId}>
                  <button
                    type="button"
                    onClick={() => setExpandedMobileRows((current) => ({ ...current, [row.playerId]: !current[row.playerId] }))}
                    aria-expanded={Boolean(expandedMobileRows[row.playerId])}
                    aria-controls={`mobile-player-stats-${row.playerId}`}
                    className="grid min-h-16 w-full grid-cols-[42px_minmax(0,1fr)_76px] items-center gap-2 px-3 py-2.5 text-left"
                  >
                    <span className="font-mono text-base font-black text-[rgb(var(--cinnabar))]">
                      #{row.pointsRank || index + 1}
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-base">
                        {row.icon}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-extrabold text-slate-950">
                          {row.displayName}
                        </h3>
                        <p className="truncate text-xs leading-5 text-slate-500">
                          {titleForStanding(
                            Math.max(1, row.pointsRank),
                            stats.length,
                            row.gamesPlayed,
                            titleRules,
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center justify-between gap-1 font-mono text-sm font-bold text-slate-900">
                      {row.totalPoints}<span aria-hidden="true" className="text-[rgb(var(--muted))]">{expandedMobileRows[row.playerId] ? '⌃' : '⌄'}</span>
                    </span>
                  </button>
                  {expandedMobileRows[row.playerId] ? (
                    <div id={`mobile-player-stats-${row.playerId}`} className="border-t border-slate-200 bg-slate-50 px-3 py-3 text-center">
                      <div className="grid grid-cols-5 gap-2">
                        <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Skill</p><p className="mt-1 font-mono text-sm font-bold text-slate-900">{row.skillRating}</p></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Games</p><p className="mt-1 font-mono text-sm font-bold text-slate-900">{row.gamesPlayed}</p></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Wins</p><p className="mt-1 font-mono text-sm font-bold text-slate-900">{row.gamesWon}</p></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Losses</p><p className="mt-1 font-mono text-sm font-bold text-slate-900">{row.gamesLost}</p></div>
                        <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Win ratio</p><p className="mt-1 font-mono text-sm font-bold text-slate-900">{formatWinRate(row.gamesWon, row.gamesPlayed)}</p></div>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            {visibleRows.length > 5 ? (
              <button
                type="button"
                onClick={() => setMobileExpanded((current) => !current)}
                className="mobile-leaderboard-toggle w-full border-t border-slate-200 px-4 py-3 text-sm font-bold text-[rgb(var(--bamboo))]"
              >
                {mobileExpanded ? 'Show fewer players' : 'Show all ' + visibleRows.length + ' players'}
              </button>
            ) : null}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <div className="min-w-[646px]" role="table" aria-label="Club leaderboard">
              <div role="row" className="grid grid-cols-[56px_minmax(150px,1.7fr)_minmax(64px,.7fr)_minmax(64px,.7fr)_minmax(52px,.55fr)_minmax(52px,.55fr)_minmax(56px,.6fr)_minmax(72px,.8fr)] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <SortHeader
                  label="Rank"
                  column="rank"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Name"
                  column="name"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Points"
                  column="points"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Skill"
                  column="skill"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Games"
                  column="games"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Wins"
                  column="wins"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Losses"
                  column="losses"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
                <SortHeader
                  label="Win ratio"
                  column="winRate"
                  active={sortKey}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </div>
              {visibleRows.map((row, index) => (
                <div
                  key={row.playerId}
                  role="row"
                  className="leaderboard-row grid grid-cols-[56px_minmax(150px,1.7fr)_minmax(64px,.7fr)_minmax(64px,.7fr)_minmax(52px,.55fr)_minmax(52px,.55fr)_minmax(56px,.6fr)_minmax(72px,.8fr)] gap-2 border-b border-slate-200/70 px-3 py-4 last:border-b-0 hover:bg-[rgb(var(--bamboo)/0.045)]"
                >
                  <div role="cell" className="flex items-center font-display text-xl font-black text-[rgb(var(--cinnabar))]">
                    #{row.pointsRank || '-'}
                  </div>
                  <div role="rowheader" className="flex min-w-0 items-start gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
                      {row.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {row.displayName}
                      </p>
                      <p className="truncate text-xs leading-5 text-slate-500">
                        {titleForStanding(
                          Math.max(1, row.pointsRank),
                          stats.length,
                          row.gamesPlayed,
                          titleRules,
                        )}
                      </p>
                    </div>
                  </div>
                  <div role="cell" className="flex items-center text-sm font-semibold text-slate-700">
                    {row.totalPoints}
                  </div>
                  <div role="cell" className="flex items-center text-sm font-semibold text-slate-700">
                    {row.skillRating}
                  </div>
                  <div role="cell" className="flex items-center text-sm font-semibold text-slate-700">
                    {row.gamesPlayed}
                  </div>
                  <div role="cell" className="flex items-center text-sm font-semibold text-slate-700">
                    {row.gamesWon}
                  </div>
                  <div role="cell" className="flex items-center text-sm font-semibold text-slate-700">
                    {row.gamesLost}
                  </div>
                  <div role="cell" className="flex items-center text-sm font-semibold text-slate-700">
                    {formatWinRate(row.gamesWon, row.gamesPlayed)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-bold text-slate-700">
            No leaderboard data yet.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Record a game in the session manager to create standings.
          </p>
        </div>
      )}
    </section>
  )
}
