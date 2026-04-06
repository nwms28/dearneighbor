import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ mailed: 0, scanned: 0, interested: 0 });
    }

    const db = createClient(url, key);
    const { data, error } = await db
      .from("homeowner_leads")
      .select("status")
      .eq("campaign_id", campaignId);

    if (error) {
      console.error("[campaigns/stats] error:", error.message);
      return NextResponse.json({ mailed: 0, scanned: 0, interested: 0 });
    }

    const rows = data ?? [];
    const mailed = rows.length;
    const scanned = rows.filter((r) => r.status && r.status !== "sent").length;
    const interested = rows.filter((r) => r.status === "interested").length;

    return NextResponse.json({ mailed, scanned, interested });
  } catch (err) {
    console.error("[campaigns/stats] unhandled error:", err);
    return NextResponse.json({ mailed: 0, scanned: 0, interested: 0 });
  }
}
