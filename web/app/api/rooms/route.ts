import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Generate a random room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    return NextResponse.json({ roomCode })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    )
  }
}