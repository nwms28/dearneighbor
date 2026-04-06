import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing campaign id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { data: campaign, error } = await db
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !campaign) {
      console.error("[campaigns/:id GET] not found:", error?.message);
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const { data: leads, error: leadsErr } = await db
      .from("homeowner_leads")
      .select("id, address, status, homeowner_name, homeowner_email, homeowner_phone, timeline, created_at")
      .eq("campaign_id", id);

    if (leadsErr) {
      console.error("[campaigns/:id GET] leads error:", leadsErr.message);
    }

    return NextResponse.json({ campaign, leads: leads ?? [] });
  } catch (err) {
    console.error("[campaigns/:id GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing campaign id" }, { status: 400 });
    }

    const body = await request.json();
    const { campaignName } = body;
    if (typeof campaignName !== "string") {
      return NextResponse.json({ error: "Missing campaignName" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await db
      .from("campaigns")
      .update({ campaign_name: campaignName.trim() || null })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("[campaigns/:id PATCH] supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaign: data });
  } catch (err) {
    console.error("[campaigns/:id PATCH] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
