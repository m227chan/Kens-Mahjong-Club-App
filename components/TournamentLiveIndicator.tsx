export default function TournamentLiveIndicator({
  name,
  secondsRemaining,
}: {
  name: string
  secondsRemaining: number
}) {
  const hours = Math.floor(secondsRemaining / 3600)
  const minutes = Math.floor((secondsRemaining % 3600) / 60)
  const seconds = secondsRemaining % 60
  const countdown = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
  return (
    <div className="tournament-live-indicator" role="timer" aria-label={`${name} tournament clock, ${countdown} remaining`}>
      <span className="tournament-live-seal" aria-hidden="true">LIVE</span>
      <span className="tournament-live-copy">
        <small>{countdown}</small>
      </span>
    </div>
  )
}
