'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/** Copies a block of text, e.g. a package pitch, ready to paste into an email. */
export function CopyButton({ text, label = 'Copy pitch' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the text is on the page to select by hand */
    }
  };

  return (
    <button type="button" className="btn ghost" onClick={copy}>
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  );
}
