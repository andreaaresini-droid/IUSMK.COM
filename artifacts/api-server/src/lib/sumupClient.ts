import crypto from "crypto";

const SUMUP_API_BASE = "https://api.sumup.com";
const SUMUP_API_KEY = process.env.SUMUP_API_KEY!;
const SUMUP_MERCHANT_EMAIL = process.env.SUMUP_MERCHANT_EMAIL!;
const SUMUP_WEBHOOK_SECRET = process.env.SUMUP_WEBHOOK_SECRET!;

export interface SumUpCheckoutParams {
  checkoutReference: string;
  amount: number;
  currency?: string;
  description: string;
  redirectUrl: string;
}

export interface SumUpCheckout {
  id: string;
  checkout_reference: string;
  status: string;
  hosted_checkout_url: string;
}

export async function createSumUpCheckout(params: SumUpCheckoutParams): Promise<SumUpCheckout> {
  const res = await fetch(`${SUMUP_API_BASE}/v0.1/checkouts`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUMUP_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      checkout_reference: params.checkoutReference,
      amount: params.amount,
      currency: params.currency ?? "EUR",
      pay_to_email: SUMUP_MERCHANT_EMAIL,
      description: params.description,
      redirect_url: params.redirectUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SumUp checkout creation failed: ${res.status} — ${err}`);
  }

  return res.json() as Promise<SumUpCheckout>;
}

export function verifySumUpWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", SUMUP_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signatureHeader.replace("sha256=", ""), "hex"),
    );
  } catch {
    return false;
  }
}

export function isSumUpConfigured(): boolean {
  return !!(SUMUP_API_KEY && SUMUP_MERCHANT_EMAIL && SUMUP_WEBHOOK_SECRET);
}
