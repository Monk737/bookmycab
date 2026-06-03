/**
 * Webhook gateway load test — fires N concurrent POSTs at a target webhook URL
 * and reports ACK latency percentiles (PRD §11: webhook ACK p95 ≤ 300ms @ 100
 * concurrent). Run after deploy against a staging gateway:
 *   pnpm loadtest:webhook -- --url https://staging/webhooks/whatsapp/<id> --total 1000
 */
import { runLoad } from "../src/lib/observability/load";
import { summarize } from "../src/lib/observability/percentile";

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const url = arg("--url", "http://localhost:3000/webhooks/whatsapp/00000000-0000-0000-0000-000000000000");
  const total = Number(arg("--total", "1000"));
  const concurrency = Number(arg("--concurrency", "100"));
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  const result = await runLoad({
    total,
    concurrency,
    send: async () => {
      const t0 = Date.now();
      await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      return Date.now() - t0;
    },
  });

  const s = summarize(result.latencies);
  console.log(JSON.stringify({ url, total, concurrency, errors: result.errors, ...s }, null, 2));
  if (s.p95 > 300) {
    console.error(`FAIL: p95 ${s.p95}ms exceeds 300ms target`);
    process.exit(1);
  }
}

void main();
