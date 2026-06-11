"use client";

/** Triggers the browser print dialog. Hidden in the printed output. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="brut-press inline-flex h-11 items-center border-[3px] border-ink bg-brut-yellow px-5 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut print:hidden"
    >
      Print voucher
    </button>
  );
}
