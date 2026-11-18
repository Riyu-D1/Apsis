"use client";

import DecryptedText from "@/components/reactbits/DecryptedText";

/**
 * Telemetry decrypt — wraps React Bits DecryptedText. `key={text}` remounts
 * on change so every new value re-runs the scramble reveal.
 */
export default function ScrambleText({
  text,
  className,
  duration = 700,
}: {
  text: string;
  className?: string;
  duration?: number;
}) {
  return (
    <DecryptedText
      key={text}
      text={text}
      animateOn="view"
      sequential
      revealDirection="start"
      speed={Math.max(18, Math.round(duration / Math.max(text.length, 1)))}
      maxIterations={8}
      useOriginalCharsOnly={false}
      characters="!<>-_\/[]{}=+*^?#@$%"
      className={className}
      encryptedClassName="opacity-50"
    />
  );
}
