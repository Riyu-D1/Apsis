import { NextResponse } from "next/server";
import { getAsteroids } from "@/lib/nasa";

export async function GET() {
  return NextResponse.json(await getAsteroids());
}
