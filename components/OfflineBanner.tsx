interface OfflineBannerProps {
  isOffline: boolean
}

export default function OfflineBanner({ isOffline }: OfflineBannerProps) {
  if (!isOffline) return null

  return (
    <div className="sticky top-0 z-50 bg-amber-400 text-amber-900 px-4 py-2 text-center text-sm font-medium">
      ⚠️ Unable to reach scoresheet — displaying last cached data
      <button
        className="ml-2 underline hover:no-underline"
        onClick={() => window.location.reload()}
      >
        Dismiss
      </button>
    </div>
  )
}