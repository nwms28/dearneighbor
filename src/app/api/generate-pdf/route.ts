// Generates a ZIP of branded PDF letters for a campaign.
//
// Requires:
//   - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   - In serverless production (Vercel/Lambda) the @sparticuz/chromium binary
//     is downloaded automatically. For local dev, set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH
//     to a local Chrome install.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import JSZip from "jszip";
import { buildLetterHtml, type ReturnAddress } from "@/lib/letter-html";

interface QrCodeRecord {
  address: string;
  token: string;
  qrCode: string;
  landingUrl: string;
}

export const runtime = "nodejs";
export const maxDuration = 300;

async function launchBrowser() {
  const localPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (localPath) {
    return puppeteer.launch({
      executablePath: localPath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
  }
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

function safeFilename(input: string, fallback: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

export async function POST(request: Request) {
  console.log("[generate-pdf] handler called");
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId } = await request.json();
    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { data: campaign, error: fetchErr } = await db
      .from("campaigns")
      .select("id, addresses, letter, qr_codes, return_address, buyer_name, user_id")
      .eq("id", campaignId)
      .single();

    if (fetchErr || !campaign) {
      console.error("[generate-pdf] campaign fetch error:", fetchErr?.message);
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (campaign.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("[generate-pdf] campaign:", {
      hasReturnAddress: !!campaign.return_address,
      returnAddress: campaign.return_address,
      addressCount: campaign.addresses?.length,
      hasLetter: !!campaign.letter,
      hasQrCodes: campaign.qr_codes?.length,
    });

    const addresses: string[] = campaign.addresses ?? [];
    const letterText: string = campaign.letter ?? "";
    const qrCodes: QrCodeRecord[] = campaign.qr_codes ?? [];
    const buyerName: string = campaign.buyer_name ?? "your neighbor";

    // Fall back to a placeholder if return_address is missing so the PDF still generates
    let returnAddress: ReturnAddress;
    if (campaign.return_address && campaign.return_address.street) {
      returnAddress = campaign.return_address;
    } else {
      console.warn("[generate-pdf] return_address missing — using placeholder");
      returnAddress = {
        street: "Return address on file",
        city: "—",
        state: "—",
        zip: "—",
      };
    }
    if (addresses.length === 0) {
      return NextResponse.json({ error: "Campaign has no addresses" }, { status: 400 });
    }

    console.log("[generate-pdf] launching headless chromium");
    const browser = await launchBrowser();
    const zip = new JSZip();

    try {
      let index = 0;
      for (const fullAddress of addresses) {
        index++;
        const qr = qrCodes.find((q) => q.address === fullAddress);
        if (!qr) {
          console.warn("[generate-pdf] no QR for address, skipping:", fullAddress);
          continue;
        }

        const html = buildLetterHtml({
          letterText,
          qrDataUrl: qr.qrCode,
          buyerName,
          returnAddress,
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });
        const pdfBuffer = await page.pdf({
          format: "letter",
          printBackground: true,
          preferCSSPageSize: true,
        });
        await page.close();

        const filename = `${String(index).padStart(3, "0")}_${safeFilename(fullAddress, `letter_${index}`)}.pdf`;
        zip.file(filename, pdfBuffer);
      }
    } finally {
      await browser.close();
    }

    console.log("[generate-pdf] zipping letters");
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    return new Response(zipBuffer as BlobPart, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="dear-neighbor-letters.zip"',
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err) {
    console.error("[generate-pdf] unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
