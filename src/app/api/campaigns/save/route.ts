// Requires STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Supabase table SQL (run once in the Supabase SQL editor):
//
// create table campaigns (
//   id uuid primary key default gen_random_uuid(),
//   user_id text not null,
//   neighborhood_name text,
//   address_count integer,
//   addresses jsonb,
//   letter text,
//   delivery_method text,
//   stripe_session_id text unique,
//   status text default 'pending',
//   created_at timestamptz default now()
// );
//
// alter table campaigns enable row level security;
// create policy "Users see own campaigns" on campaigns
//   for all using (auth.uid()::text = user_id);

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  console.log("[campaigns/save] handler hit");

  try {
    const body = await request.json();
    const { sessionId, neighborhoodName, addresses, confirmedAddresses, generatedLetter, deliveryMethod } = body;

    // Resolve userId: prefer client-supplied value, fall back to server-side auth()
    let { userId } = body;
    if (!userId) {
      const serverAuth = await auth();
      userId = serverAuth.userId;
      console.log("[campaigns/save] userId from body was missing — using server auth():", userId);
    }

    if (!userId) {
      console.error("[campaigns/save] No userId from body or auth() — returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Log full incoming payload so we can confirm data is arriving correctly
    console.log("[campaigns/save] Save payload:", JSON.stringify({
      sessionId,
      userId,
      neighborhoodName,
      deliveryMethod,
      addressesCount: addresses?.length,
      confirmedAddressesCount: confirmedAddresses?.length,
      generatedLetterLength: generatedLetter?.length,
    }));

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    // Check Stripe env
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error("[campaigns/save] STRIPE_SECRET_KEY is not set");
      return NextResponse.json({ error: "Payment service not configured" }, { status: 500 });
    }

    // Check Supabase env — must be service_role key, not anon key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log("[campaigns/save] Supabase URL set:", !!supabaseUrl, "| URL prefix:", supabaseUrl?.slice(0, 30));
    console.log("[campaigns/save] Supabase service_role key set:", !!supabaseKey, "| key prefix:", supabaseKey?.slice(0, 12));
    if (!supabaseUrl || !supabaseKey) {
      console.error("[campaigns/save] Supabase env vars missing — URL:", !!supabaseUrl, "KEY:", !!supabaseKey);
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    // Verify Stripe payment
    const stripe = new Stripe(stripeKey);
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      console.error("[campaigns/save] Stripe retrieve error:", err);
      return NextResponse.json({ error: "Invalid Stripe session" }, { status: 400 });
    }

    console.log("[campaigns/save] Stripe payment_status:", session.payment_status);
    if (session.payment_status !== "paid") {
      console.warn("[campaigns/save] Payment not completed, status:", session.payment_status);
      return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
    }

    // Save to Supabase using service_role client (bypasses RLS for server-side writes)
    const db = createClient(supabaseUrl, supabaseKey);
    const insertRow = {
      user_id: userId,
      neighborhood_name: neighborhoodName,
      address_count: confirmedAddresses?.length ?? addresses?.length ?? 0,
      addresses: confirmedAddresses ?? addresses ?? [],
      letter: generatedLetter,
      delivery_method: deliveryMethod,
      stripe_session_id: sessionId,
      status: "active",
    };
    console.log("[campaigns/save] inserting row:", JSON.stringify({ ...insertRow, letter: insertRow.letter?.slice(0, 40) }));

    const { data, error } = await db
      .from("campaigns")
      .upsert(insertRow, { onConflict: "stripe_session_id" })
      .select()
      .single();

    if (error) {
      console.error("[campaigns/save] Supabase error:", JSON.stringify(error));
      console.error("[campaigns/save] Supabase error message:", error.message);
      console.error("[campaigns/save] Supabase error code:", error.code);
      console.error("[campaigns/save] Supabase error details:", error.details);
      console.error("[campaigns/save] Supabase error hint:", error.hint);
      return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 500 });
    }

    console.log("[campaigns/save] saved campaign id:", data?.id);
    return NextResponse.json({ campaign: data });
  } catch (err) {
    console.error("[campaigns/save] unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
