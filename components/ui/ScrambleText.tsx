"use client";

import { useEffect, useState } from "react";

const CHARS = "!<>-_\\/[]{}=+*^?#@$%&";

export default function ScrambleText({
  text,
  className,
  duration = 700,
}: {
  text: string;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    let frame = 0;
    const total = Math.max(10, Math.round(duration / 28));
    const iv = setInterval(() => {
      frame++;
      const resolved = Math.floor((frame / total) * text.length);
      if (frame >= total) {
        setDisplay(text);
        clearInterval(iv);
        return;
      }
      setDisplay(
        text
          .split("")
          .map((ch, i) =>
            ch === " "
              ? " "
              : i < resolved
                ? ch
                : CHARS[Math.floor(Math.random() * CHARS.length)],
          )
          .join(""),
      );
    }, 28);
    return () => clearInterval(iv);
  }, [text, duration]);

  return (
    <span className={className} suppressHydrationWarning>
      {display}
    </span>
  );
}
