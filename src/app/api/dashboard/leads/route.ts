import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

// Returns all homeowner_leads for the current user, joined with campaign info.
// Optional ?status=scanned (status != 'sent') or ?status=interested.
export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "all";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ leads: [] });
    }

    const db = createClient(supabaseUrl, supabaseKey);

    // First find the user's campaign ids so we can scope the lead query.
    const { data: campaigns, error: cErr } = await db
      .from("campaigns")
      .select("id, campaign_name, neighborhood_name")
      .eq("user_id", userId);

    if (cErr) {
      console.error("[dashboard/leads] campaigns error:", cErr.message);
      return NextResponse.json({ leads: [] });
    }

    const campaignIds = (campaigns ?? []).map((c) => c.id);
    if (campaignIds.length === 0) {
      return NextResponse.json({ leads: [] });
    }

    const nameById = new Map<string, string>();
    for (const c of campaigns ?? []) {
      nameById.set(c.id, c.campaign_name || c.neighborhood_name || "Unnamed campaign");
    }

    let query = db
      .from("homeowner_leads")
      .select("id, campaign_id, address, status, homeowner_name, homeowner_email, homeowner_phone, timeline, created_at")
      .in("campaign_id", campaignIds)
      .order("created_at", { ascending: false });

    if (status === "scanned") {
      query = query.neq("status", "sent");
    } else if (status === "interested") {
      query = query.eq("status", "interested");
    }

    const { data: leads, error: lErr } = await query;
    if (lErr) {
      console.error("[dashboard/leads] leads error:", lErr.message);
      return NextResponse.json({ leads: [] });
    }

    const enriched = (leads ?? []).map((l) => ({
      ...l,
      campaign_name: nameById.get(l.campaign_id) ?? "Unnamed campaign",
    }));

    return NextResponse.json({ leads: enriched });
  } catch (err) {
    console.error("[dashboard/leads] unhandled error:", err);
    return NextResponse.json({ leads: [] });
  }
}
