// Sends physical letters via Lob for a given campaign.
//
// Requires LOB_API_KEY and the standard Supabase env vars.
// Adds a `lob_letter_id` text column to homeowner_leads (run once):
//   alter table homeowner_leads add column if not exists lob_letter_id text;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  Configuration,
  LettersApi,
  LetterEditable,
  AddressEditable,
  CountryExtended,
  LtrUseType,
} from "@lob/lob-typescript-sdk";

interface ParsedAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
}

interface QrCodeRecord {
  address: string;
  token: string;
  qrCode: string; // data:image/png;base64,...
  landingUrl: string;
}

interface ReturnAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
}

// Parses both:
//   "6017 INDIANOLA AVE, INDIANAPOLIS IN, 46220-2013"
//   "6706 lakeway st, Ypsilanti MI 48197"
function parseAddress(fullAddress: string): ParsedAddress | null {
  const parts = fullAddress.split(",").map((p) => p.trim());
  if (parts.length < 2) return null;

  const street = parts[0];
  let city = "";
  let state = "";
  let zip = "";

  if (parts.length === 2) {
    // "Street, City ST ZIP"
    const match = parts[1].match(/^(.*?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (!match) return null;
    city = match[1];
    state = match[2];
    zip = match[3].split("-")[0];
  } else if (parts.length === 3) {
    // Could be "Street, City ST, ZIP" or "Street, City, ST ZIP"
    const lastPart = parts[2];
    const middlePart = parts[1];

    // Case 1: "INDIANAPOLIS IN, 46220-2013" — state at end of middle, zip in last
    const midStateMatch = middlePart.match(/^(.*?)\s+([A-Z]{2})$/);
    const lastZipMatch = lastPart.match(/^(\d{5}(?:-\d{4})?)$/);
    if (midStateMatch && lastZipMatch) {
      city = midStateMatch[1];
      state = midStateMatch[2];
      zip = lastZipMatch[1].split("-")[0];
    } else {
      // Case 2: "City, ST ZIP" — state+zip together in last part
      const lastMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      if (lastMatch) {
        city = middlePart;
        state = lastMatch[1];
        zip = lastMatch[2].split("-")[0];
      } else {
        // Case 3: city state zip all in last part
        const fullMatch = lastPart.match(/^(.*?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
        if (fullMatch) {
          city = middlePart;
          state = fullMatch[2];
          zip = fullMatch[3].split("-")[0];
        } else {
          return null;
        }
      }
    }
  } else {
    // 4+ parts — take last two as state/zip candidates
    const lastPart = parts[parts.length - 1];
    const middlePart = parts[parts.length - 2];
    const midStateMatch = middlePart.match(/^(.*?)\s+([A-Z]{2})$/);
    const lastZipMatch = lastPart.match(/^(\d{5}(?:-\d{4})?)$/);
    if (midStateMatch && lastZipMatch) {
      city = midStateMatch[1] || parts[parts.length - 3];
      state = midStateMatch[2];
      zip = lastZipMatch[1].split("-")[0];
    } else {
      return null;
    }
  }

  if (!state || !zip) return null;
  return { street, city, state, zip };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLetterHtml(opts: {
  letterText: string;
  qrDataUrl: string;
  buyerName: string;
  returnAddress: ReturnAddress;
}): string {
  const { letterText, qrDataUrl, buyerName, returnAddress } = opts;
  const safeLetter = escapeHtml(letterText).replace(/\n/g, "<br/>");
  const returnLine2 = [returnAddress.street, returnAddress.unit].filter(Boolean).join(", ");
  const returnLine3 = `${returnAddress.city}, ${returnAddress.state} ${returnAddress.zip}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Letter</title>
<style>
  @page { size: 8.5in 11in; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #0f1f3d;
    width: 8.5in;
    height: 11in;
    box-sizing: border-box;
    padding: 1in 1in 0.75in 1in;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    text-align: center;
    font-family: Georgia, serif;
    font-size: 22pt;
    font-weight: 700;
    color: #0f1f3d;
    letter-spacing: -0.01em;
    margin-bottom: 0.45in;
    border-bottom: 1px solid #c9a84c;
    padding-bottom: 0.18in;
  }
  .letter {
    font-size: 12pt;
    line-height: 1.55;
    color: #0f1f3d;
    white-space: normal;
  }
  .qr-block {
    margin-top: 0.4in;
    text-align: center;
  }
  .qr-block img {
    width: 1.6in;
    height: 1.6in;
  }
  .qr-caption {
    margin-top: 0.1in;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #c9a84c;
    font-weight: 600;
  }
  .return {
    position: absolute;
    bottom: 0.5in;
    left: 1in;
    right: 1in;
    text-align: center;
    font-family: Helvetica, Arial, sans-serif;
    font-size: 8pt;
    color: #64748b;
    border-top: 1px solid #e2e8f0;
    padding-top: 0.1in;
  }
</style>
</head>
<body>
  <div class="header">Dear &middot; Neighbor</div>

  <div class="letter">${safeLetter}</div>

  <div class="qr-block">
    <img src="${qrDataUrl}" alt="QR code" />
    <div class="qr-caption">Scan to respond directly to ${escapeHtml(buyerName)}</div>
  </div>

  <div class="return">
    ${escapeHtml(buyerName)} &middot; ${escapeHtml(returnLine2)} &middot; ${escapeHtml(returnLine3)}
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const { campaignId } = await request.json();
    console.log("[send-letters] handler called with campaignId:", campaignId);
    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    console.log("[send-letters] LOB_API_KEY set:", !!process.env.LOB_API_KEY);
    const lobKey = process.env.LOB_API_KEY;
    if (!lobKey) {
      console.error("[send-letters] LOB_API_KEY is not set");
      return NextResponse.json({ error: "Mail service not configured" }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { data: campaign, error: fetchErr } = await db
      .from("campaigns")
      .select("id, addresses, letter, qr_codes, return_address, buyer_name")
      .eq("id", campaignId)
      .single();

    if (fetchErr || !campaign) {
      console.error("[send-letters] campaign fetch error:", fetchErr?.message);
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const addresses: string[] = campaign.addresses ?? [];
    const letterText: string = campaign.letter ?? "";
    const qrCodes: QrCodeRecord[] = campaign.qr_codes ?? [];
    const returnAddress: ReturnAddress | null = campaign.return_address ?? null;
    const buyerName: string = campaign.buyer_name ?? "your neighbor";

    console.log("[send-letters] campaign found:", {
      addressCount: addresses.length,
      hasReturnAddress: !!returnAddress,
      hasQrCodes: qrCodes?.length,
    });

    if (!returnAddress) {
      return NextResponse.json({ error: "Campaign is missing a return address" }, { status: 400 });
    }
    if (addresses.length === 0) {
      return NextResponse.json({ error: "Campaign has no addresses" }, { status: 400 });
    }

    const lob = new LettersApi(new Configuration({ username: lobKey }));

    const fromAddress: AddressEditable = new AddressEditable({
      name: buyerName,
      address_line1: returnAddress.street,
      address_line2: returnAddress.unit || undefined,
      address_city: returnAddress.city,
      address_state: returnAddress.state,
      address_zip: returnAddress.zip,
      address_country: CountryExtended.Us,
    });

    let sent = 0;
    let failed = 0;

    for (const fullAddress of addresses) {
      try {
        const parsed = parseAddress(fullAddress);
        console.log("[send-letters] parsed address:", parsed);
        if (!parsed) {
          console.error("[send-letters] could not parse address:", fullAddress);
          failed++;
          continue;
        }

        const qr = qrCodes.find((q) => q.address === fullAddress);
        if (!qr) {
          console.error("[send-letters] no QR code for address:", fullAddress);
          failed++;
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
          address_line2: parsed.unit || undefined,
          address_city: parsed.city,
          address_state: parsed.state,
          address_zip: parsed.zip,
          address_country: CountryExtended.Us,
        });

        const letterEditable: LetterEditable = new LetterEditable({
          description: `Dear Neighbor campaign ${campaignId}`,
          to: toAddress,
          from: fromAddress,
          file: html,
          color: true,
          double_sided: false,
          use_type: LtrUseType.Marketing,
        });

        console.log("[send-letters] sending letter to:", fullAddress);
        const letter = await lob.create(letterEditable);
        const lobLetterId = letter.id;
        console.log("[send-letters] Lob success, letter id:", lobLetterId);

        if (lobLetterId) {
          const { error: updateErr } = await db
            .from("homeowner_leads")
            .update({ lob_letter_id: lobLetterId })
            .eq("token", qr.token);

          if (updateErr) {
            console.error("[send-letters] failed to update lead:", updateErr.message);
          }
        }

        sent++;
      } catch (err) {
        console.error("[send-letters] Lob error:", err);
        console.error("[send-letters] failed to send letter for", fullAddress);
        failed++;
      }
    }

    console.log(`[send-letters] done — sent: ${sent}, failed: ${failed}`);
    return NextResponse.json({ success: true, sent, failed });
  } catch (err) {
    console.error("[send-letters] unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
