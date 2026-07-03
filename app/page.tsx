import DashboardContent from '@/components/DashboardContent'
import { LeaderboardPanel } from '@/components/Leaderboard'
import SessionManager from '@/components/SessionManager'

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-6">
          <LeaderboardPanel compact />
          <DashboardContent />
        </div>
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <SessionManager />
        </aside>
      </div>
    </main>
  )
}
