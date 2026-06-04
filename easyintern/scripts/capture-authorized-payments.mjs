#!/usr/bin/env node
/**
 * Capture Razorpay payments that are still "authorized".
 *
 * Usage:
 *   export RAZORPAY_KEY_ID=rzp_live_xxxx
 *   export RAZORPAY_KEY_SECRET=your_secret
 *   node scripts/capture-authorized-payments.mjs captures/payment-ids-first-10.json
 *
 * Do NOT commit keys. Use live keys only when Test Mode is OFF in dashboard.
 */

import { readFileSync } from "fs";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const listPath = process.argv[2] || "captures/payment-ids-first-10.json";

if (!keyId || !keySecret) {
  console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment.");
  process.exit(1);
}

const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
const headers = {
  Authorization: `Basic ${auth}`,
  "Content-Type": "application/json",
};

async function razorpay(path, options = {}) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.description || body?.error?.reason || res.statusText;
    throw new Error(`${res.status} ${path}: ${msg}`);
  }
  return body;
}

const items = JSON.parse(readFileSync(listPath, "utf8"));
if (!Array.isArray(items) || items.length === 0) {
  console.error("List file must be a non-empty JSON array.");
  process.exit(1);
}

console.log(`Processing ${items.length} payment(s) from ${listPath}\n`);

for (const row of items) {
  const id = row.payment_id || row.id;
  if (!id) continue;

  try {
    const pay = await razorpay(`/payments/${id}`);
    const status = pay.status;
    const amount = Math.floor(
      Number(
        typeof row.amount_paise === "number" && row.amount_paise > 0
          ? row.amount_paise
          : pay.amount
      )
    );

    if (status === "captured") {
      console.log(`OK  ${id}  already captured`);
      continue;
    }
    if (status !== "authorized") {
      console.log(`SKIP ${id}  status=${status}`);
      continue;
    }

    await razorpay(`/payments/${id}/capture`, {
      method: "POST",
      body: JSON.stringify({ amount, currency: "INR" }),
    });
    console.log(`CAP ${id}  ₹${amount / 100}  captured`);
  } catch (err) {
    console.error(`ERR ${id}  ${err.message}`);
  }
}
