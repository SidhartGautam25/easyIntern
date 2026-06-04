#!/usr/bin/env node
/**
 * List all Razorpay payments still in "authorized" state and capture them safely.
 *
 * Safety:
 *   - Default is --dry-run (preview only). Pass --execute to capture.
 *   - Re-fetches each payment immediately before capture.
 *   - Capture amount always comes from Razorpay API (never guessed).
 *   - Skips non-authorized, already captured, failed, refunded.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node scripts/list-and-capture-authorized.mjs --dry-run
 *   node scripts/list-and-capture-authorized.mjs --execute
 *
 * Optional:
 *   --from=2026-05-15  --to=2026-05-17   (IST dates, inclusive start)
 *   --max=50                            (limit captures per run)
 */

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const args = process.argv.slice(2);
const dryRun = !args.includes("--execute");
const maxArg = args.find((a) => a.startsWith("--max="));
/** Default high enough for bulk backfill runs; use --max=N to limit. */
const maxCaptures = maxArg ? Math.max(1, parseInt(maxArg.split("=")[1], 10)) : 5000;
const fromArg = args.find((a) => a.startsWith("--from="));
const toArg = args.find((a) => a.startsWith("--to="));

if (!keyId || !keySecret) {
  console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (e.g. source .env).");
  process.exit(1);
}

const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
const headers = {
  Authorization: `Basic ${auth}`,
  "Content-Type": "application/json",
};

function parseDateToUnixStart(dateStr) {
  if (!dateStr) return undefined;
  const t = Date.parse(`${dateStr}T00:00:00+05:30`);
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
}

function parseDateToUnixEnd(dateStr) {
  if (!dateStr) return undefined;
  const t = Date.parse(`${dateStr}T23:59:59+05:30`);
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
}

const fromTs = parseDateToUnixStart(fromArg?.split("=")[1]);
const toTs = parseDateToUnixEnd(toArg?.split("=")[1]);

async function razorpay(path, options = {}) {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.description || body?.error?.reason || res.statusText;
    throw new Error(`${res.status} ${path}: ${msg}`);
  }
  return body;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Paginate /payments and return only items still authorized. */
async function fetchAllAuthorizedPayments() {
  const pageSize = 100;
  let skip = 0;
  const authorized = [];

  for (;;) {
    const qs = new URLSearchParams({ count: String(pageSize), skip: String(skip) });
    if (fromTs) qs.set("from", String(fromTs));
    if (toTs) qs.set("to", String(toTs));

    const page = await razorpay(`/payments?${qs}`);
    const items = page.items || [];
    for (const p of items) {
      if (p.status === "authorized" && p.captured !== true) {
        authorized.push(p);
      }
    }
    if (items.length < pageSize) break;
    skip += pageSize;
    if (skip > 10000) {
      console.warn("Stopped pagination at 10000 rows — narrow --from/--to if needed.");
      break;
    }
    await sleep(200);
  }

  return authorized;
}

async function captureOne(paymentId) {
  const pay = await razorpay(`/payments/${paymentId}`);
  const status = pay.status;
  const amount = Math.floor(Number(pay.amount));

  if (status === "captured") {
    return { action: "already_captured", amount };
  }
  if (status !== "authorized") {
    return { action: "skip", status, amount };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { action: "skip", status, reason: "invalid amount", amount };
  }

  await razorpay(`/payments/${paymentId}/capture`, {
    method: "POST",
    body: JSON.stringify({ amount, currency: "INR" }),
  });

  const after = await razorpay(`/payments/${paymentId}`);
  if (after.status !== "captured") {
    return { action: "error", reason: `still ${after.status} after capture call`, amount };
  }
  return { action: "captured", amount };
}

async function main() {
  console.log(`Mode: ${dryRun ? "DRY RUN (preview only)" : "EXECUTE (will capture)"}`);
  console.log(`Key ID: ${keyId.slice(0, 12)}…`);
  if (fromTs || toTs) {
    console.log(`Date filter (IST): from=${fromArg?.split("=")[1] || "—"} to=${toArg?.split("=")[1] || "—"}`);
  }
  console.log(`Max captures this run: ${maxCaptures}\n`);

  console.log("Fetching payments from Razorpay…");
  const list = await fetchAllAuthorizedPayments();
  console.log(`Found ${list.length} payment(s) with status=authorized.\n`);

  if (list.length === 0) {
    console.log("Nothing to capture. Done.");
    return;
  }

  const stats = { captured: 0, already: 0, skipped: 0, errors: 0, dryListed: 0 };
  let processed = 0;

  for (const p of list) {
    if (!dryRun && stats.captured >= maxCaptures) {
      console.log(`\nReached --max=${maxCaptures}. Stopping.`);
      break;
    }

    const id = p.id;
    const rupees = (p.amount || 0) / 100;
    const created = p.created_at ? new Date(p.created_at * 1000).toISOString() : "—";

    if (dryRun) {
      console.log(`WOULD CAPTURE  ${id}  ₹${rupees}  created=${created}`);
      stats.dryListed++;
      continue;
    }

    try {
      const result = await captureOne(id);
      processed++;
      if (result.action === "captured") {
        console.log(`CAP  ${id}  ₹${result.amount / 100}  captured`);
        stats.captured++;
      } else if (result.action === "already_captured") {
        console.log(`OK   ${id}  already captured`);
        stats.already++;
      } else if (result.action === "skip") {
        console.log(`SKIP ${id}  status=${result.status || result.reason}`);
        stats.skipped++;
      } else {
        console.log(`ERR  ${id}  ${result.reason}`);
        stats.errors++;
      }
    } catch (err) {
      console.error(`ERR  ${id}  ${err.message}`);
      stats.errors++;
    }

    await sleep(350);
  }

  console.log("\n--- Summary ---");
  if (dryRun) {
    console.log(`Would capture: ${stats.dryListed}`);
    console.log("\nRe-run with --execute to capture for real:");
    console.log("  node scripts/list-and-capture-authorized.mjs --execute");
  } else {
    console.log(`Captured:          ${stats.captured}`);
    console.log(`Already captured:  ${stats.already}`);
    console.log(`Skipped:           ${stats.skipped}`);
    console.log(`Errors:            ${stats.errors}`);
    console.log(`Processed:         ${processed}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
