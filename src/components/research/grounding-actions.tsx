"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GroundingBundle } from "@/lib/ai/grounding";

export function GroundingActions({ bundle }: { bundle: GroundingBundle }) {
  const [copied, setCopied] = useState(false);

  async function copyPacket() {
    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={copyPacket}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy grounding JSON"}
      </Button>
      <Button asChild variant="ghost" size="sm">
        <a href={`/api/stocks/${bundle.symbol}/grounding`} target="_blank" rel="noopener noreferrer">
          Open raw JSON
        </a>
      </Button>
    </div>
  );
}
