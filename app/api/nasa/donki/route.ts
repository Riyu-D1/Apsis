import { NextResponse } from "next/server";
import { getSolar } from "@/lib/nasa";

export async function GET() {
  return NextResponse.json(await getSolar());
}
