import Link from 'next/link'

const definitions = [
  ['Points', 'The running total of the scores written into game records. A positive score adds points and a negative score removes them. Points preserve exactly what happened at the table; they do not adjust for experience or opponent strength.'],
  ['Skill Rating', 'Our experience-aware estimate of playing strength. It looks at finishing order—not the size of the payout—so one unusually expensive hand cannot dominate the rating. Beating stronger, well-established players is more meaningful than repeatedly beating newcomers.'],
  ['Experience handling', 'During a player’s first 20 games, the rating is still learning their level. Their own estimate can adjust, but established players receive less rating evidence from repeatedly beating them. This happens quietly behind the scenes and makes farming newcomers ineffective.'],
  ['Skill Rank', 'The player’s position after everyone is ordered by Skill Rating. Number 1 is the highest. Players with limited history are ranked conservatively because the app is less certain about their level.'],
  ['Points Rank', 'The player’s position after everyone is ordered by total Points. Unlike Skill Rank, this rewards accumulated table results and is affected by how often someone plays.'],
  ['Games', 'The number of recorded games in which the player took part. Skill Rating rebuilds from every historical log after both the older and newer log formats have been normalized into the same player-and-score entries.'],
  ['Wins and losses', 'A win is a game with a positive score. A loss is a game with a negative score. A zero score is neither, including drawn games and players who neither won nor paid the winning discard.'],
  ['Win rate', 'Wins divided by Games, shown as a percentage. It answers “How often did this player finish with a positive result?”'],
  ['Win/loss ratio', 'Wins divided by Losses. A value of 2 means two wins for every recorded loss. It differs from win rate because neutral results are not part of the denominator.'],
  ['Points per game', 'Total Points divided by Games. It helps compare average scoring output between players who attended different numbers of games.'],
  ['Best and worst game', 'The largest positive score and largest negative score in one recorded game. These describe extremes; they do not receive extra weight in Skill Rating.'],
  ['Days attended', 'The number of different calendar dates on which the player has a comparable recorded game. Multiple games on one date count as one attended day.'],
  ['Recent Skill trend', 'The total Skill Rating movement across the latest five games. It is a short-term direction indicator, not a separate ranking system.'],
  ['Skill Headroom', 'The distance between a player’s highest-ever Skill Rating and their current Skill Rating. Zero means the player is currently at their peak.'],
  ['Rank Alignment', 'The distance between Skill Rank and Points Rank. A small number means the two views tell a similar story; a large number often reflects attendance, a short history, or unusually large scores.'],
  ['Cumulative score chart', 'A timeline made by adding each selected player’s scores in date order. It shows how their raw Points changed over the chosen range.'],
  ['Skill rank chart', 'A timeline of each selected player’s place in the Skill standings. Moving upward means their rank number became smaller.'],
  ['Fan and base points', 'Fan describes the value of a winning hand. The scoring table converts fan into base points, then applies self-draw or discard rules. This affects Points but Skill Rating only uses finishing order.']
] as const

export default function MetricsPage() {
  return <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
    <Link href="/" className="text-sm font-bold text-[rgb(var(--bamboo))]">← Back to the app</Link>
    <header className="mt-5 rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[.2em] text-[rgb(var(--cinnabar))]">Metric definitions</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950">What the numbers mean</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">The app keeps two complementary stories: <strong>Points</strong> are the literal scorebook, while <strong>Skill Rating</strong> estimates playing strength after accounting for experience and the quality of the evidence.</p>
    </header>
    <section className="mt-5 grid gap-3 sm:grid-cols-2">
      {definitions.map(([name, explanation]) => <article key={name} className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-black text-slate-950">{name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{explanation}</p>
      </article>)}
    </section>
    <aside className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-slate-700"><strong>Why Skill Rating replaced ELO:</strong> the previous calculation reacted too strongly to recent games, large payouts, and inexperienced opponents. Skill Rating uses multiplayer finishing order, tracks how much evidence is available, and gives established players more stable ratings when they play newer opponents.</aside>
  </main>
}
