import { NextResponse } from "next/server";
import { getScoutIntelligence } from "@/lib/fpl";

export async function GET() {
  try {
    const data = await getScoutIntelligence();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Footy scout intelligence is temporarily unavailable.",
      },
      { status: 502 },
    );
  }
}
