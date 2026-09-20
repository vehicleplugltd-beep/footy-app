import { NextResponse } from "next/server";
import { getScoutIntelligence } from "@/lib/fpl";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const data = await getScoutIntelligence({
      allFixtureForecasts: url.searchParams.get("forecast") === "all",
    });
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
