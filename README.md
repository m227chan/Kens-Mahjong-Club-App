# Ken's Mahjong Club Score Tracker

A free, mobile-first web app for tracking scores in any Mahjong group. Works with any number of players. Syncs to Google Sheets.

## Features

- 🏆 Live leaderboard with dynamic titles
- ➕ Score entry with zero-sum validation
- 📊 Cumulative score and rank bump charts
- 🀄 HK Mahjong fan→points calculator
- 👤 Add new players at any time

## Title System (Dynamic)

Titles are assigned based on rank out of total players:

| Rank        | Title    | Emoji |
|-------------|----------|-------|
| 1st         | Messiah  | 👑    |
| 2nd         | Master   | 🏆    |
| Middle      | Monk     | 🧘    |
| 3rd to last | Minion   | 🪄    |
| 2nd to last | Mongrel  | 🐶    |
| Last        | Moron    | 🤡    |

New players always start as Monk.

## Setup Your Own Group

### 1. Google Sheets Setup

Create a sheet with this structure:
```
Row 1 (headers): Datetime | Alice | Bob | Charlie | Diana | ...
```

Add as many player columns as your group needs. Share the sheet with your service account email (Editor access).

### 2. Google Service Account

- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Create project → Enable Google Sheets API
- Create Service Account → Download JSON key
- Share your Google Sheet with the service account email

### 3. Local Development

```bash
git clone https://github.com/YOUR_USERNAME/Ken-s-Mahjong-Club-Score-Tracker
cd Ken-s-Mahjong-Club-Score-Tracker
npm install
cp .env.example .env.local
# Fill in your values in .env.local
npm run dev
```

### 4. Deploy to Vercel (Free)

- Push repo to GitHub
- Connect repo at [vercel.com](https://vercel.com)
- Add environment variables:
  - `GOOGLE_SERVICE_ACCOUNT_KEY` → paste your JSON key (stringified)
  - `NEXT_PUBLIC_SHEET_ID` → your Google Sheet ID
- Deploy → share the *.vercel.app URL with your group

### 5. Add to Home Screen

- **iOS Safari**: Share → Add to Home Screen
- **Android Chrome**: Menu → Add to Home Screen

## Example Data (for testing)

Players: Alice, Bob, Charlie, Diana
Sheet ID: `EXAMPLE_SHEET_ID_FOR_TESTING`

*All example data — not real players or real sheets*

## Development

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run test     # Run tests
npm run lint     # Run ESLint
```

## Architecture

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API routes (serverless)
- **Data**: Google Sheets API v4
- **Charts**: Recharts
- **Deployment**: Vercel (static export)

## License

MIT
