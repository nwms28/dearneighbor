// Requires RESEND_API_KEY env var.
// Optional: ADMIN_NOTIFICATION_EMAIL — internal address to notify on each signup.

import { Resend } from "resend";

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
