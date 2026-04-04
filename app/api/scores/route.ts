import { NextRequest, NextResponse } from 'next/server'
import { getSheetData, appendGameRound } from '@/lib/sheets'
import { validateRound } from '@/lib/scoring'
import { GameRound } from '@/lib/types'

export async function GET() {
  try {
    const data = await getSheetData()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data', isOffline: true },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scores }: { scores: Record<string, number> } = body

    if (!scores || typeof scores !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid scores object' },
        { status: 400 }
      )
    }

    // Validate the round sums to 0
    const validation = validateRound(scores)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.message },
        { status: 400 }
      )
    }

    // Get current players from sheet
    const sheetData = await getSheetData()
    const players = sheetData.players

    // Create the round object
    const round: GameRound = {
      datetime: new Date().toISOString(),
      scores
    }

    // Append to sheet
    await appendGameRound(round, players)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to save round' },
      { status: 500 }
    )
  }
}