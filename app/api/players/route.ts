import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name }: { name: string } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid player name' },
        { status: 400 }
      )
    }

    // In a real implementation, this would add a column to the Google Sheet
    // For now, we'll just return success since we're using mock data
    console.log(`Would add player: ${name.trim()}`)

    return NextResponse.json({
      success: true,
      message: `Player ${name.trim()} added`
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to add player' },
      { status: 500 }
    )
  }
}