// Generates a ZIP of branded PDF letters for a campaign in the background.
//
// Flow:
//   1. Validate user, fetch campaign, return 202 immediately.
//   2. In `after()` (post-response background work) — render PDFs in batches of 10,
//      zip them, upload to the Supabase `pdf-downloads` storage bucket, generate a
//      7-day signed URL, and email the buyer with the link via Resend.
//
// Requires:
//   - NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   - RESEND_API_KEY
//   - Supabase Storage bucket `pdf-downloads` (private)
//   - Vercel Pro plan for maxDuration > 10s

import { NextResponse, after } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Resend } from "resend";
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

const STORAGE_BUCKET = "pdf-downloads";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

async function launchBrowser() {
  if (process.env.VERCEL) {
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  return puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    headless: true,
  });
}

function safeFilename(input: string, fallback: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "_");
  return cleaned || fallback;
}

interface RenderJob {
  campaignId: string;
  addresses: string[];
  letterText: string;
  qrCodes: QrCodeRecord[];
  returnAddress: ReturnAddress;
  buyerName: string;
  buyerEmail: string | null;
}

async function runRenderJob(db: SupabaseClient, job: RenderJob) {
  const { campaignId, addresses, letterText, qrCodes, returnAddress, buyerName, buyerEmail } = job;
  console.log("[generate-pdf] background job started for", campaignId, "with", addresses.length, "addresses");

  let browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    console.error("[generate-pdf] browser launch error:", err);
    console.error("[generate-pdf] VERCEL env:", process.env.VERCEL);
    try {
      console.error("[generate-pdf] executablePath:", await chromium.executablePath());
    } catch (pathErr) {
      console.error("[generate-pdf] executablePath lookup failed:", pathErr);
    }
    return;
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
  } catch (err) {
    console.error("[generate-pdf] render loop error:", err);
  } finally {
    try {
      await browser.close();
    } catch {
      // ignore
    }
  }

  console.log("[generate-pdf] zipping letters");
  let zipBuffer: Uint8Array;
  try {
    zipBuffer = await zip.generateAsync({ type: "uint8array" });
  } catch (err) {
    console.error("[generate-pdf] zip generate error:", err);
    return;
  }

  // Upload to Supabase Storage
  const objectPath = `${campaignId}/${Date.now()}-dear-neighbor-letters.zip`;
  console.log("[generate-pdf] uploading to storage:", objectPath);
  const { error: uploadErr } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, zipBuffer, {
      contentType: "application/zip",
      upsert: true,
    });
  if (uploadErr) {
    console.error("[generate-pdf] storage upload failed:", uploadErr.message);
    return;
  }

  // 7-day signed URL
  const { data: signed, error: signErr } = await db.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    console.error("[generate-pdf] signed URL failed:", signErr?.message);
    return;
  }

  console.log("[generate-pdf] signed URL ready, length:", signed.signedUrl.length);

  // Email the buyer
  if (!buyerEmail) {
    console.warn("[generate-pdf] no buyer email — skipping notification");
    return;
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[generate-pdf] RESEND_API_KEY not set — skipping notification");
    return;
  }

  const resend = new Resend(resendKey);
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f1f3d;">
      <h1 style="font-size: 24px; margin: 0 0 16px 0; color: #0f1f3d;">Your letters are ready 📬</h1>
      <p style="color: #475569; line-height: 1.6;">
        We&rsquo;ve generated ${addresses.length} printable letter${addresses.length !== 1 ? "s" : ""} for your campaign.
      </p>
      <p style="margin: 28px 0;">
        <a href="${signed.signedUrl}"
           style="background: #c9a84c; color: #0f1f3d; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-decoration: none;">
          Download your PDFs
        </a>
      </p>
      <p style="color: #94a3b8; font-size: 12px; line-height: 1.6;">
        This download link is valid for 7 days. If it expires, sign in to your Dear Neighbor dashboard
        and request a new download from the campaign page.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">— The Dear Neighbor team</p>
    </div>
  `;
  try {
    const { error: emailErr } = await resend.emails.send({
      from: "notifications@dearneighbor.ai",
      to: buyerEmail,
      subject: "Your Dear Neighbor letters are ready 📬",
      html,
    });
    if (emailErr) {
      console.error("[generate-pdf] resend send failed:", emailErr);
    } else {
      console.log("[generate-pdf] download email sent to", buyerEmail);
    }
  } catch (err) {
    console.error("[generate-pdf] resend threw:", err);
  }
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

    const addresses: string[] = campaign.addresses ?? [];
    if (addresses.length === 0) {
      return NextResponse.json({ error: "Campaign has no addresses" }, { status: 400 });
    }

    const letterText: string = campaign.letter ?? "";
    const qrCodes: QrCodeRecord[] = campaign.qr_codes ?? [];
    const buyerName: string = campaign.buyer_name ?? "your neighbor";

    let returnAddress: ReturnAddress;
    if (campaign.return_address && campaign.return_address.street) {
      returnAddress = campaign.return_address;
    } else {
      console.warn("[generate-pdf] return_address missing — using placeholder");
      returnAddress = { street: "Return address on file", city: "—", state: "—", zip: "—" };
    }

    // Look up buyer email from Clerk
    let buyerEmail: string | null = null;
    try {
      const user = await currentUser();
      buyerEmail =
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses?.[0]?.emailAddress ??
        null;
    } catch (err) {
      console.error("[generate-pdf] could not load Clerk user:", err);
    }

    console.log("[generate-pdf] queueing background job for", addresses.length, "addresses, buyer:", buyerEmail);

    // Background work — runs after the response is sent
    after(
      runRenderJob(db, {
        campaignId,
        addresses,
        letterText,
        qrCodes,
        returnAddress,
        buyerName,
        buyerEmail,
      })
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Your PDFs are being prepared. Check your email for the download link.",
      },
      { status: 202 }
    );
  } catch (err) {
    console.error("[generate-pdf] unhandled error:", err);
    return NextResponse.json(
      {
        error: "PDF generation failed. Please try again or contact support.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
