// Charges $2.99 per additional letter when expanding an existing campaign.
// No platform fee — only mailing cost.

import Stripe from "stripe";
import { NextResponse } from "next/server";

const PER_LETTER_CENTS = 299;

export async function POST(request: Request) {
  try {
    const { campaignId, newAddressCount } = await request.json();

    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    }
    if (!newAddressCount || newAddressCount < 1) {
      return NextResponse.json({ error: "newAddressCount must be at least 1" }, { status: 400 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
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
              name: "Dear Neighbor — Campaign expansion",
              description: `Mailing ${newAddressCount} additional letter${newAddressCount !== 1 ? "s" : ""}`,
            },
            unit_amount: PER_LETTER_CENTS,
          },
          quantity: newAddressCount,
        },
      ],
      metadata: {
        campaignId,
        newAddressCount: String(newAddressCount),
        kind: "expansion",
      },
      success_url: `${origin}/dashboard/campaigns/${campaignId}?expanded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/campaigns/${campaignId}`,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error("[create-expansion-checkout] error:", err);
    return NextResponse.json({ error: "Failed to create expansion checkout" }, { status: 500 });
  }
}
