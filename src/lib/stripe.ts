import Stripe from "stripe";

/**
 * Lazy Stripe client so self-hosted deployments (no STRIPE_* env) can build
 * and run without keys — billing routes 404 the feature before ever
 * touching this when SELF_HOSTED=true.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!client) {
    client = new Stripe(key);
  }
  return client;
}
