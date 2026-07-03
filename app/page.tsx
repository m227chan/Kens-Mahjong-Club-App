import AnalyticsPanel from '@/components/AnalyticsPanel'
import DashboardContent from '@/components/DashboardContent'
import { LeaderboardPanel } from '@/components/Leaderboard'
import SessionManager from '@/components/SessionManager'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-5 text-slate-900">
      <div className="mx-auto grid max-w-7xl gap-5 xl:grid-cols-[176px_minmax(0,1fr)_430px]">
        <aside className="hidden xl:block">
          <nav className="sticky top-24 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            {[
              ['Session', '#session'],
              ['Leaderboard', '#leaderboard'],
              ['Dashboard', '#dashboard'],
              ['Analytics', '#analytics']
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="block rounded-md px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-5 xl:order-2">
          <section id="leaderboard">
            <LeaderboardPanel compact />
          </section>
          <DashboardContent />
          <AnalyticsPanel />
        </div>

        <aside id="session" className="xl:sticky xl:top-24 xl:order-3 xl:self-start">
          <SessionManager />
        </aside>
      </div>
    </div>
  )
}
