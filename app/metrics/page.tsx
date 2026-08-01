import Link from 'next/link'

const metricGroups = [
  {
    id: 'scoring',
    title: 'Scoring',
    description: 'How table results become points, wins, losses, and per-game records.',
    definitions: [
      ['Points', 'The running total of the scores written into game records. A positive score adds points and a negative score removes them. Points preserve exactly what happened at the table; they do not adjust for experience or opponent strength.'],
      ['Wins and losses', 'A win is a game with a positive score. A loss is a game with a negative score. A zero score is neither, including drawn games and players who neither won nor paid the winning discard.'],
      ['Win rate', 'Wins divided by Games, shown as a percentage. It answers “How often did this player finish with a positive result?”'],
      ['Win/loss ratio', 'Wins divided by Losses. A value of 2 means two wins for every recorded loss. It differs from win rate because neutral results are not part of the denominator.'],
      ['Points per game', 'Total Points divided by Games. It helps compare average scoring output between players who attended different numbers of games.'],
      ['Best and worst game', 'The largest positive score and largest negative score in one recorded game. These describe extremes; they do not receive extra weight in Skill Rating.'],
      ['Fan and base points', 'Fan describes the value of a winning hand. The scoring table converts fan into base points, then applies self-draw or discard rules. This affects Points but Skill Rating only uses finishing order.'],
    ],
  },
  {
    id: 'ranking',
    title: 'Ranking',
    description: 'How the club compares playing strength with accumulated table results.',
    definitions: [
      ['Skill Rating', 'Our experience-aware estimate of playing strength. It looks at finishing order—not the size of the payout—so one unusually expensive hand cannot dominate the rating. Beating stronger, well-established players is more meaningful than repeatedly beating newcomers.'],
      ['Experience handling', 'During a player’s first 20 games, the rating is still learning their level. Their own estimate can adjust, but established players receive less rating evidence from repeatedly beating them. This happens quietly behind the scenes and makes farming newcomers ineffective.'],
      ['Skill Rank', 'The player’s position after everyone is ordered by Skill Rating. Number 1 is the highest. Players with limited history are ranked conservatively because the app is less certain about their level.'],
      ['Points Rank', 'The player’s position after everyone is ordered by total Points. Unlike Skill Rank, this rewards accumulated table results and is affected by how often someone plays.'],
      ['Rank Alignment', 'The distance between Skill Rank and Points Rank. A small number means the two views tell a similar story; a large number often reflects attendance, a short history, or unusually large scores.'],
    ],
  },
  {
    id: 'trends-history',
    title: 'Trends & history',
    description: 'How activity, peaks, and recent movement are summarized over time.',
    definitions: [
      ['Games', 'The number of recorded games in which the player took part. Skill Rating rebuilds from every historical log after both the older and newer log formats have been normalized into the same player-and-score entries.'],
      ['Days attended', 'The number of different calendar dates on which the player has a comparable recorded game. Multiple games on one date count as one attended day.'],
      ['Recent Skill trend', 'The total Skill Rating movement across the latest five games. It is a short-term direction indicator, not a separate ranking system.'],
      ['Skill Headroom', 'The distance between a player’s highest-ever Skill Rating and their current Skill Rating. Zero means the player is currently at their peak.'],
      ['Cumulative score chart', 'A timeline made by adding each selected player’s scores in date order. It shows how their raw Points changed over the chosen range.'],
      ['Skill rank chart', 'A timeline of each selected player’s place in the Skill standings. Moving upward means their rank number became smaller.'],
    ],
  },
] as const

export default function MetricsPage() {
  return (
    <main className="metrics-page mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/" className="metrics-back-link inline-flex min-h-11 items-center text-sm font-bold text-[rgb(var(--bamboo))]">
        ← Back to the app
      </Link>

      <header className="metrics-hero mt-4 rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[.2em] text-[rgb(var(--cinnabar))]">Metric definitions</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">What the numbers mean</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          The app keeps two complementary stories: <strong>Points</strong> are the literal scorebook, while <strong>Skill Rating</strong> estimates playing strength after accounting for experience and the quality of the evidence.
        </p>
        <nav className="metrics-category-nav mt-5 flex flex-wrap gap-2" aria-label="Metric categories">
          {metricGroups.map((group) => (
            <a
              key={group.id}
              href={`#${group.id}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 transition hover:border-[rgb(var(--bamboo))] hover:text-[rgb(var(--bamboo))]"
            >
              {group.title}
            </a>
          ))}
        </nav>
      </header>

      <div className="metrics-groups mt-6 grid gap-6">
        {metricGroups.map((group, groupIndex) => (
          <section
            key={group.id}
            id={group.id}
            className="metrics-group scroll-mt-24"
            aria-labelledby={`${group.id}-heading`}
          >
            <header className="metrics-group-header mb-3 px-1">
              <p className="text-xs font-black uppercase tracking-[.16em] text-[rgb(var(--cinnabar))]">
                {String(groupIndex + 1).padStart(2, '0')}
              </p>
              <h2 id={`${group.id}-heading`} className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                {group.title}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{group.description}</p>
            </header>

            <div className="metrics-definition-list grid gap-2">
              {group.definitions.map(([name, explanation], definitionIndex) => (
                <details
                  key={name}
                  className="metric-definition group rounded-lg border border-slate-200 bg-white"
                  open={definitionIndex === 0}
                >
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left marker:content-none sm:px-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="text-base font-black text-slate-950">{name}</h3>
                    <span
                      aria-hidden="true"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-50 text-lg font-black text-slate-600 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
                    <p className="max-w-3xl text-sm leading-6 text-slate-600">{explanation}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="metrics-elo-note mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-slate-700">
        <strong>Why Skill Rating replaced ELO:</strong> the previous calculation reacted too strongly to recent games, large payouts, and inexperienced opponents. Skill Rating uses multiplayer finishing order, tracks how much evidence is available, and gives established players more stable ratings when they play newer opponents.
      </aside>
    </main>
  )
}
