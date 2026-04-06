// Charges $2.99 per confirmed address for printing & mailing.
// After payment Stripe redirects to /dashboard/new-campaign/send?session_id={CHECKOUT_SESSION_ID}

import Stripe from "stripe";
import { NextResponse } from "next/server";

const PER_LETTER_CENTS = 299; // $2.99

export async function POST(request: Request) {
  try {
    const { confirmedCount } = await request.json();

    if (!confirmedCount || confirmedCount < 1) {
      return NextResponse.json({ error: "confirmedCount must be at least 1" }, { status: 400 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY is not set");
      return NextResponse.json({ error: "Payment service is not configured" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey);
    const origin = request.headers.get("origin") ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Dear Neighbor — Letter printing & mailing",
              description: `${confirmedCount} letter${confirmedCount !== 1 ? "s" : ""} printed and mailed to your confirmed addresses`,
            },
            unit_amount: PER_LETTER_CENTS,
          },
          quantity: confirmedCount,
        },
      ],
      success_url: `${origin}/dashboard/new-campaign/send?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/new-campaign/review`,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("Stripe mailing checkout error:", err);
    return NextResponse.json({ error: "Failed to create mailing checkout session" }, { status: 500 });
  }
}
