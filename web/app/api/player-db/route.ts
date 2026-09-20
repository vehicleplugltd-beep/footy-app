import { NextResponse } from "next/server";
import { getPlayerDatabase } from "@/lib/fpl";

export async function GET() {
  try {
    const data = await getPlayerDatabase();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Footy player database is temporarily unavailable.",
      },
      { status: 502 },
    );
  }
}
