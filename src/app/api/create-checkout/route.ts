// Requires STRIPE_SECRET_KEY in environment
// After payment Stripe redirects to /dashboard/new-campaign/addresses?session_id={CHECKOUT_SESSION_ID}

import Stripe from "stripe";
import { NextResponse } from "next/server";

const CAMPAIGN_FEE_CENTS = 4900; // $49.00 — includes address lookup, letter generation, up to 100 addresses

export async function POST(request: Request) {
  try {
    await request.json(); // consume body (no fields required at this stage)

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
              name: "Dear Neighbor — Campaign fee",
              description: "Includes address lookup, letter generation, and up to 100 addresses",
            },
            unit_amount: CAMPAIGN_FEE_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard/new-campaign/addresses?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/new-campaign/checkout`,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
