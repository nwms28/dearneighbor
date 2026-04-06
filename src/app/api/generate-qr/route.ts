// Supabase table (run once in the Supabase SQL editor):
//
// create table homeowner_leads (
//   id uuid primary key default gen_random_uuid(),
//   campaign_id uuid references campaigns(id),
//   address text not null,
//   token text unique not null,
//   homeowner_name text,
//   homeowner_email text,
//   homeowner_phone text,
//   timeline text,
//   status text default 'sent',
//   created_at timestamptz default now()
// );
// alter table homeowner_leads enable row level security;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

export async function POST(request: Request) {
  try {
    const { campaignId, addressId, address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const token = crypto.randomUUID();
    const landingUrl = `https://dearneighbor.ai/home/${token}`;

    // Save lead to Supabase
    const db = createClient(supabaseUrl, supabaseKey);
    const { error: dbError } = await db.from("homeowner_leads").insert({
      campaign_id: campaignId ?? null,
      address,
      token,
      status: "sent",
    });

    if (dbError) {
      console.error("[generate-qr] Supabase error:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Generate QR code as base64 PNG
    const qrDataUrl = await QRCode.toDataURL(landingUrl, {
      type: "image/png",
      margin: 2,
      width: 300,
      color: {
        dark: "#0f1f3d",
        light: "#ffffff",
      },
    });

    console.log("[generate-qr] generated QR for address:", address, "token:", token);

    return NextResponse.json({
      token,
      landingUrl,
      qrCode: qrDataUrl,
      addressId: addressId ?? null,
    });
  } catch (err) {
    console.error("[generate-qr] unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
