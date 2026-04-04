import mailchimp from "@mailchimp/mailchimp_marketing";

export async function POST(request: Request) {
  mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_API_SERVER,
  });

  const { email } = await request.json();

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Invalid email address" }, { status: 400 });
  }

  try {
    await mailchimp.lists.addListMember(process.env.MAILCHIMP_AUDIENCE_ID!, {
      email_address: email,
      status: "subscribed",
    });

    return Response.json({ success: true });
  } catch (err: unknown) {
    const error = err as {
      status?: number;
      response?: { body?: { title?: string; detail?: string }; text?: string };
    };
    const body = error?.response?.body;
    const text = error?.response?.text;

    // Mailchimp returns 400 with title "Member Exists" if already subscribed
    if (body?.title === "Member Exists") {
      return Response.json({ success: true });
    }

    console.error("Mailchimp error:", {
      status: error?.status,
      title: body?.title,
      detail: body?.detail,
      raw: body ?? text,
    });

    return Response.json({ success: false });
  }
}
