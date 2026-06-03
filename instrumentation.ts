// Next.js calls register() once per server runtime at boot (next.config instrumentation hook).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initObservability } = await import("@/lib/observability/init");
    initObservability();
  }
}
