"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser; failing silently is fine here.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy revenue summary"
      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white transition-colors hover:bg-white/30"
    >
      {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
    </button>
  );
}
