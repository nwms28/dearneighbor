import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const { data: lead, error } = await db
    .from("homeowner_leads")
    .select("id, address, status, campaign_id, campaigns(neighborhood_name, letter, buyer_name, buyer_city)")
    .eq("token", token)
    .single();

  console.log("[leads] campaign data:", JSON.stringify(lead));

  if (error || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // campaigns may come back as an array depending on PostgREST relationship inference
  const campaignRaw = (lead as { campaigns?: unknown }).campaigns;
  const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;

  return NextResponse.json({
    id: lead.id,
    address: lead.address,
    status: lead.status,
    campaigns: {
      letter: campaign?.letter ?? "",
      neighborhood_name: campaign?.neighborhood_name ?? "",
      buyer_name: campaign?.buyer_name ?? null,
      buyer_city: campaign?.buyer_city ?? null,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const update: Record<string, unknown> = {};
  if (body.status) update.status = body.status;
  if (body.homeownerName !== undefined) update.homeowner_name = body.homeownerName;
  if (body.homeownerEmail !== undefined) update.homeowner_email = body.homeownerEmail;
  if (body.homeownerPhone !== undefined) update.homeowner_phone = body.homeownerPhone;
  if (body.timeline !== undefined) update.timeline = body.timeline;

  const { error } = await db
    .from("homeowner_leads")
    .update(update)
    .eq("token", token);

  if (error) {
    console.error("[leads PATCH] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
