// Expands an existing campaign with additional addresses after the buyer pays
// for an expansion checkout. Verifies the Stripe payment, generates QR codes,
// appends to the campaign rows in Supabase, and dispatches Lob letters.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import QRCode from "qrcode";
import {
  Configuration,
  LettersApi,
  LetterEditable,
  AddressEditable,
  CountryExtended,
  LtrUseType,
} from "@lob/lob-typescript-sdk";
import { buildLetterHtml, type ReturnAddress } from "@/lib/letter-html";

interface QrCodeRecord {
  address: string;
  token: string;
  qrCode: string;
  landingUrl: string;
}

interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

function parseAddress(fullAddress: string): ParsedAddress | null {
  const parts = fullAddress.split(",").map((p) => p.trim());
  if (parts.length < 2) return null;
  const street = parts[0];
  let city = "";
  let state = "";
  let zip = "";
  if (parts.length === 2) {
    const m = parts[1].match(/^(.*?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (!m) return null;
    city = m[1];
    state = m[2];
    zip = m[3].split("-")[0];
  } else {
    const lastPart = parts[parts.length - 1];
    const middlePart = parts[parts.length - 2];
    const midStateMatch = middlePart.match(/^(.*?)\s+([A-Z]{2})$/);
    const lastZipMatch = lastPart.match(/^(\d{5}(?:-\d{4})?)$/);
    if (midStateMatch && lastZipMatch) {
      city = midStateMatch[1];
      state = midStateMatch[2];
      zip = lastZipMatch[1].split("-")[0];
    } else {
      const lastMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (lastMatch) {
        city = middlePart;
        state = lastMatch[1];
        zip = lastMatch[2].split("-")[0];
      } else {
        const fullMatch = lastPart.match(/^(.*?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
        if (fullMatch) {
          city = middlePart;
          state = fullMatch[2];
          zip = fullMatch[3].split("-")[0];
        } else return null;
      }
    }
  }
  if (!state || !zip) return null;
  return { street, city, state, zip };
}

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("[campaigns/:id/expand] handler called");
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: campaignId } = await params;
    const { newAddresses, sessionId } = await request.json();

    if (!Array.isArray(newAddresses) || newAddresses.length === 0) {
      return NextResponse.json({ error: "newAddresses must be a non-empty array" }, { status: 400 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!supabaseUrl || !supabaseKey || !stripeKey) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Verify Stripe payment for this expansion
    const stripe = new Stripe(stripeKey);
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      console.error("[expand] stripe retrieve failed:", err);
      return NextResponse.json({ error: "Invalid Stripe session" }, { status: 400 });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
    }
    if (session.metadata?.campaignId !== campaignId) {
      return NextResponse.json({ error: "Session does not match campaign" }, { status: 400 });
    }

    const db = createClient(supabaseUrl, supabaseKey);

    const { data: campaign, error: fetchErr } = await db
      .from("campaigns")
      .select("id, addresses, qr_codes, letter, return_address, buyer_name, user_id")
      .eq("id", campaignId)
      .single();

    if (fetchErr || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (campaign.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingAddresses: string[] = campaign.addresses ?? [];
    const existingQrCodes: QrCodeRecord[] = campaign.qr_codes ?? [];
    const existingSet = new Set(existingAddresses);

    // Filter out anything already in the campaign
    const toAdd: string[] = [];
    for (const a of newAddresses as string[]) {
      if (typeof a !== "string" || !a.trim()) continue;
      if (existingSet.has(a)) continue;
      toAdd.push(a);
    }
    console.log("[expand] adding", toAdd.length, "new addresses");

    if (toAdd.length === 0) {
      return NextResponse.json({ success: true, newCount: 0 });
    }

    const letterText: string = campaign.letter ?? "";
    const buyerName: string = campaign.buyer_name ?? "your neighbor";
    const returnAddress: ReturnAddress | null = campaign.return_address ?? null;

    // 1. Generate QR code + lead row for each new address
    const newQrCodes: QrCodeRecord[] = [];
    for (const address of toAdd) {
      const token = crypto.randomUUID();
      const landingUrl = `https://dearneighbor.ai/home/${token}`;

      const { error: leadErr } = await db.from("homeowner_leads").insert({
        campaign_id: campaignId,
        address,
        token,
        status: "sent",
      });
      if (leadErr) {
        console.error("[expand] lead insert failed:", leadErr.message);
        continue;
      }

      const qrDataUrl = await QRCode.toDataURL(landingUrl, {
        type: "image/png",
        margin: 2,
        width: 300,
        color: { dark: "#0f1f3d", light: "#ffffff" },
      });

      newQrCodes.push({ address, token, qrCode: qrDataUrl, landingUrl });
    }

    // 2. Append to campaign row
    const mergedAddresses = [...existingAddresses, ...toAdd];
    const mergedQrCodes = [...existingQrCodes, ...newQrCodes];
    const { error: updateErr } = await db
      .from("campaigns")
      .update({
        addresses: mergedAddresses,
        qr_codes: mergedQrCodes,
        address_count: mergedAddresses.length,
      })
      .eq("id", campaignId);

    if (updateErr) {
      console.error("[expand] campaign update failed:", updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 3. Dispatch Lob letters for the new addresses only
    let mailedSent = 0;
    let mailedFailed = 0;
    if (returnAddress && process.env.LOB_API_KEY) {
      const lob = new LettersApi(new Configuration({ username: process.env.LOB_API_KEY }));
      const fromAddress: AddressEditable = new AddressEditable({
        name: buyerName,
        address_line1: returnAddress.street,
        address_line2: returnAddress.unit || undefined,
        address_city: returnAddress.city,
        address_state: returnAddress.state,
        address_zip: returnAddress.zip,
        address_country: CountryExtended.Us,
      });

      for (const qr of newQrCodes) {
        try {
          const parsed = parseAddress(qr.address);
          if (!parsed) {
            console.error("[expand] could not parse address:", qr.address);
            mailedFailed++;
            continue;
          }
          const html = buildLetterHtml({
            letterText,
            qrDataUrl: qr.qrCode,
            buyerName,
            returnAddress,
          });
          const toAddress: AddressEditable = new AddressEditable({
            name: "Current Resident",
            address_line1: parsed.street,
            address_city: parsed.city,
            address_state: parsed.state,
            address_zip: parsed.zip,
            address_country: CountryExtended.Us,
          });
          const letter: LetterEditable = new LetterEditable({
            description: `Dear Neighbor expansion ${campaignId}`,
            to: toAddress,
            from: fromAddress,
            file: html,
            color: true,
            double_sided: false,
            use_type: LtrUseType.Marketing,
          });
          const created = await lob.create(letter);
          if (created.id) {
            await db
              .from("homeowner_leads")
              .update({ lob_letter_id: created.id })
              .eq("token", qr.token);
          }
          mailedSent++;
        } catch (err) {
          console.error("[expand] Lob error for", qr.address, err);
          mailedFailed++;
        }
      }
    } else {
      console.warn("[expand] skipping Lob — missing return address or LOB_API_KEY");
    }

    console.log("[expand] done — added:", toAdd.length, "mailed:", mailedSent, "failed:", mailedFailed);
    return NextResponse.json({
      success: true,
      newCount: toAdd.length,
      mailed: mailedSent,
      mailedFailed,
    });
  } catch (err) {
    console.error("[campaigns/:id/expand] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
