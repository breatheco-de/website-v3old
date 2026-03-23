import { useState, useEffect, useRef } from "react";

export function useTypewriter(
  text: string,
  charDelay = 40,
  startDelay = 600,
) {
  const [visibleChars, setVisibleChars] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisibleChars(0);
    startRef.current = setTimeout(() => {
      let i = 0;
      timerRef.current = setInterval(() => {
        i++;
        setVisibleChars(i);
        if (i >= text.length) {
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, charDelay);
    }, startDelay);

    return () => {
      if (startRef.current) clearTimeout(startRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [text, charDelay, startDelay]);

  return {
    displayText: text.slice(0, visibleChars),
    isDone: visibleChars >= text.length,
  };
}
