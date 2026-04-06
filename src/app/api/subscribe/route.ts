// Requires RESEND_API_KEY env var.
// Optional: ADMIN_NOTIFICATION_EMAIL — internal address to notify on each signup.

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[subscribe] RESEND_API_KEY not set");
    return Response.json({ success: false }, { status: 500 });
  }

  const resend = new Resend(resendKey);

  // Welcome email to the subscriber
  const welcomeHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f1f3d;">
      <h1 style="font-size: 24px; margin: 0 0 16px 0; color: #0f1f3d;">
        You&rsquo;re on the list 🏠
      </h1>
      <p style="color: #475569; line-height: 1.6;">
        Thanks for signing up! We&rsquo;ll let you know when Dear Neighbor is available in your area.
      </p>
      <p style="color: #475569; line-height: 1.6;">
        In the meantime, check out
        <a href="https://dearneighbor.ai" style="color: #c9a84c;">dearneighbor.ai</a>
        to learn more.
      </p>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
        — The Dear Neighbor team
      </p>
    </div>
  `;

  try {
    const { error: welcomeError } = await resend.emails.send({
      from: "notifications@dearneighbor.ai",
      to: email,
      subject: "You're on the Dear Neighbor waitlist 🏠",
      html: welcomeHtml,
    });

    if (welcomeError) {
      console.error("[subscribe] welcome send failed:", welcomeError);
      return Response.json({ success: false }, { status: 500 });
    }
  } catch (err) {
    console.error("[subscribe] welcome send threw:", err);
    return Response.json({ success: false }, { status: 500 });
  }

  // Internal notification — fire-and-forget so a failure here doesn't block signup
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (adminEmail) {
    const adminHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0f1f3d;">
        <h1 style="font-size: 20px; margin: 0 0 12px 0;">New waitlist signup</h1>
        <p style="color: #475569;">
          <strong>${escapeHtml(email)}</strong> just joined the Dear Neighbor waitlist.
        </p>
      </div>
    `;
    resend.emails
      .send({
        from: "notifications@dearneighbor.ai",
        to: adminEmail,
        subject: `📬 New waitlist signup: ${email}`,
        html: adminHtml,
      })
      .catch((err) => console.error("[subscribe] admin notify failed:", err));
  }

  // Save to Supabase waitlist table — silently ignore duplicates
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      const db = createClient(supabaseUrl, supabaseKey);
      const { error: insertErr } = await db.from("waitlist").insert({ email });
      if (insertErr && insertErr.code !== "23505") {
        // 23505 = unique_violation — duplicate emails are fine
        console.error("[subscribe] waitlist insert failed:", insertErr.message);
      }
    } catch (err) {
      console.error("[subscribe] waitlist insert threw:", err);
    }
  } else {
    console.warn("[subscribe] Supabase env vars missing — skipping waitlist insert");
  }

  console.log("[subscribe] sent welcome to", email);
  return Response.json({ success: true });
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
