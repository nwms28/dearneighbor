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
export const maxDuration = 60; // requires Vercel Pro plan — Hobby is capped at 10s

async function launchBrowser() {
  if (process.env.VERCEL) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  // Local dev — use a local Chrome install
  return puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
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
    console.log("[generate-pdf] VERCEL env:", process.env.VERCEL);
    console.log("[generate-pdf] address count:", addresses.length);

    let browser;
    try {
      browser = await launchBrowser();
    } catch (err) {
      console.error("[generate-pdf] browser launch error:", err);
      console.error("[generate-pdf] VERCEL env:", process.env.VERCEL);
      try {
        const exePath = await chromium.executablePath();
        console.error("[generate-pdf] executablePath:", exePath);
      } catch (pathErr) {
        console.error("[generate-pdf] executablePath lookup failed:", pathErr);
      }
      return NextResponse.json(
        {
          error:
            "Could not start the PDF generator. Try a smaller campaign (under 5 addresses) or contact support if this keeps happening.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    const zip = new JSZip();

    const BATCH_SIZE = 10;
    try {
      for (let start = 0; start < addresses.length; start += BATCH_SIZE) {
        const batch = addresses.slice(start, start + BATCH_SIZE);
        await Promise.all(
          batch.map(async (fullAddress, batchIdx) => {
            const i = start + batchIdx;
            console.log("[generate-pdf] rendering PDF", i + 1, "of", addresses.length);

            const qr = qrCodes.find((q) => q.address === fullAddress);
            if (!qr) {
              console.warn("[generate-pdf] no QR for address, skipping:", fullAddress);
              return;
            }

            const html = buildLetterHtml({
              letterText,
              qrDataUrl: qr.qrCode,
              buyerName,
              returnAddress,
            });

            const page = await browser.newPage();
            try {
              await page.setContent(html, { waitUntil: "networkidle0" });
              const pdfBuffer = await page.pdf({
                format: "letter",
                printBackground: true,
                preferCSSPageSize: true,
              });
              const filename = `${String(i + 1).padStart(3, "0")}_${safeFilename(fullAddress, `letter_${i + 1}`)}.pdf`;
              zip.file(filename, pdfBuffer);
            } finally {
              await page.close();
            }
          })
        );
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
    const message = err instanceof Error ? err.message : String(err);
    // Common timeout / OOM signature → guide the user toward a smaller batch
    const isTimeout = /timeout|timed out|FUNCTION_INVOCATION_TIMEOUT/i.test(message);
    return NextResponse.json(
      {
        error: isTimeout
          ? "PDF generation took too long. Try a smaller campaign (under 5 addresses) or contact support."
          : "PDF generation failed. Try a smaller campaign (under 5 addresses) or contact support.",
        detail: message,
      },
      { status: 500 }
    );
  }
}
