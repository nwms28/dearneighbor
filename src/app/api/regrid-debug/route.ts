import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.REGRID_API_KEY;

  // Check account usage/status
  const res = await fetch(
    `https://app.regrid.com/api/v1/usage.json?token=${apiKey}`
  );
  const text = await res.text();

  return NextResponse.json({
    status: res.status,
    body: text,
  });
}
