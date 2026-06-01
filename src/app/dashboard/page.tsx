// Temporary holding-state page — will be replaced by the full tenant dashboard in Epic 7.
// PRD §9.2 step-6: show a "building" message until the first automation goes live.

import { requireUser } from "@/lib/auth/session";
import { signOut } from "@/app/(auth)/actions";

export default async function DashboardPage() {
  // Guard: unauthenticated users are redirected to /login by requireUser().
  // MFA gating (Owner/Admin without aal2) is handled by middleware before reaching here.
  await requireUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm text-center">
        <div className="mb-4 text-xl font-semibold tracking-tight text-slate-900">
          Cabby<span className="text-indigo-600">Bot</span>
        </div>

        <h1 className="mb-3 text-2xl font-semibold text-slate-900">
          Your automation is being built.
        </h1>

        <p className="mb-8 text-sm text-slate-500 leading-relaxed">
          We&apos;ll notify you when it goes live.
        </p>

        <form action={signOut}>
          <button
            type="submit"
            className="cursor-pointer rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
