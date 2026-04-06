import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const status = searchParams.get("status") ?? "all";
    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({ leads: [] });
    }

    const db = createClient(url, key);
    let query = db
      .from("homeowner_leads")
      .select("id, address, homeowner_name, homeowner_email, homeowner_phone, timeline, status, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (status === "scanned") {
      query = query.neq("status", "sent");
    } else if (status === "interested") {
      query = query.eq("status", "interested");
    }

    const { data, error } = await query;
    if (error) {
      console.error("[campaigns/leads] error:", error.message);
      return NextResponse.json({ leads: [] });
    }

    return NextResponse.json({ leads: data ?? [] });
  } catch (err) {
    console.error("[campaigns/leads] unhandled error:", err);
    return NextResponse.json({ leads: [] });
  }
}
