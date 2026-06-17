import { diffLines } from "@/lib/voice/prompt-diff";

const ROW: Record<string, string> = {
  same: "text-gray-600",
  add: "bg-brut-lime/40 text-ink",
  remove: "bg-brut-red/30 text-ink line-through decoration-ink/40",
};
const GUTTER: Record<string, string> = { same: " ", add: "+", remove: "-" };

/** Old → new system-prompt diff on a hairline ink frame. Read-only, monospace. */
export function PromptDiff({ oldPrompt, newPrompt }: { oldPrompt: string; newPrompt: string }) {
  const lines = diffLines(oldPrompt, newPrompt);
  return (
    <div className="scrollbar-ink max-h-72 overflow-auto border-2 border-ink bg-paper font-mono text-[11px] leading-relaxed">
      {lines.map((l, idx) => (
        <div key={idx} className={`flex gap-2 px-2 ${ROW[l.type]}`}>
          <span aria-hidden="true" className="w-3 shrink-0 select-none text-ink/40">{GUTTER[l.type]}</span>
          <span className="whitespace-pre-wrap break-words">{l.text || " "}</span>
        </div>
      ))}
    </div>
  );
}
