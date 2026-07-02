import DashboardContent from '@/components/DashboardContent'
import SessionManager from '@/components/SessionManager'

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <DashboardContent />
        <SessionManager />
      </div>
    </main>
  )
}