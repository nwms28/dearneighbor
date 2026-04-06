// Requires RESEND_API_KEY env var.
// Sends a notification email to the campaign buyer when a homeowner expresses interest.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clerkClient } from "@clerk/nextjs/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }
    if (!resendKey) {
      return NextResponse.json({ error: "Resend not configured" }, { status: 500 });
    }

    const db = createClient(supabaseUrl, supabaseKey);
    const { data: lead, error } = await db
      .from("homeowner_leads")
      .select(
        "id, address, homeowner_name, homeowner_email, homeowner_phone, timeline, campaigns(user_id, neighborhood_name)"
      )
      .eq("token", token)
      .single();

    if (error || !lead) {
      console.error("[notify-buyer] lead lookup failed:", error?.message);
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const campaignRaw = (lead as { campaigns?: unknown }).campaigns;
    const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
    const buyerUserId = campaign?.user_id as string | undefined;
    if (!buyerUserId) {
      return NextResponse.json({ error: "Campaign owner missing" }, { status: 404 });
    }

    // Look up buyer email via Clerk
    const clerk = await clerkClient();
    const buyer = await clerk.users.getUser(buyerUserId);
    const buyerEmail = buyer.emailAddresses.find(
      (e) => e.id === buyer.primaryEmailAddressId
    )?.emailAddress ?? buyer.emailAddresses[0]?.emailAddress;

    if (!buyerEmail) {
      return NextResponse.json({ error: "Buyer email not found" }, { status: 404 });
    }

    const timelineLabel: Record<string, string> = {
      ready: "Ready soon",
      "few-months": "In a few months",
      exploring: "Just exploring",
    };
    const timelineDisplay = timelineLabel[lead.timeline ?? ""] ?? lead.timeline ?? "—";

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f1f3d;">
        <h1 style="font-size: 24px; margin: 0 0 8px 0; color: #0f1f3d;">
          🏠 Someone at ${escapeHtml(lead.address)} wants to talk
        </h1>
        <p style="color: #64748b; margin: 0 0 24px 0;">
          A homeowner just responded to your Dear Neighbor letter.
        </p>

        <div style="background: #f8fafc; border-left: 4px solid #c9a84c; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 4px 0; color: #64748b; width: 110px;">Name</td><td style="padding: 4px 0; font-weight: 600;">${escapeHtml(lead.homeowner_name ?? "—")}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Email</td><td style="padding: 4px 0;"><a href="mailto:${escapeHtml(lead.homeowner_email ?? "")}" style="color: #c9a84c;">${escapeHtml(lead.homeowner_email ?? "—")}</a></td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Phone</td><td style="padding: 4px 0;">${escapeHtml(lead.homeowner_phone ?? "—")}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Timeline</td><td style="padding: 4px 0;">${escapeHtml(timelineDisplay)}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Property</td><td style="padding: 4px 0;">${escapeHtml(lead.address)}</td></tr>
          </table>
        </div>

        <a href="https://dearneighbor.ai/dashboard" style="display: inline-block; background: #c9a84c; color: #0f1f3d; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Open dashboard →
        </a>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
          You're receiving this because you launched a Dear Neighbor campaign.
        </p>
      </div>
    `;

    const resend = new Resend(resendKey);
    const { error: sendError } = await resend.emails.send({
      from: "notifications@dearneighbor.ai",
      to: buyerEmail,
      subject: `🏠 Someone at ${lead.address} wants to talk`,
      html,
    });

    if (sendError) {
      console.error("[notify-buyer] Resend error:", sendError);
      return NextResponse.json({ error: "Email send failed" }, { status: 500 });
    }

    console.log("[notify-buyer] sent to", buyerEmail, "for lead", lead.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify-buyer] unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
