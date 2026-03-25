import { useState, useEffect, useRef } from "react";

export function useTypewriter(
  text: string,
  charDelay = 40,
  startDelay = 600,
  isActive = true,
) {
  const [visibleChars, setVisibleChars] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!isActive) {
      setVisibleChars(0);
      return;
    }

    setVisibleChars(0);

    const scheduleType = (chars: number, delay: number) => {
      if (cancelledRef.current) return;
      timerRef.current = setTimeout(() => {
        if (cancelledRef.current) return;
        const next = chars + 1;
        setVisibleChars(next);
        if (next >= text.length) {
          scheduleErase(next, 3000);
        } else {
          scheduleType(next, charDelay);
        }
      }, delay);
    };

    const scheduleErase = (chars: number, delay: number) => {
      if (cancelledRef.current) return;
      timerRef.current = setTimeout(() => {
        if (cancelledRef.current) return;
        const next = chars - 1;
        setVisibleChars(next);
        if (next <= 0) {
          scheduleType(0, 2000);
        } else {
          scheduleErase(next, charDelay);
        }
      }, delay);
    };

    timerRef.current = setTimeout(() => {
      scheduleType(0, 0);
    }, startDelay);

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, charDelay, startDelay, isActive]);

  return {
    visibleChars,
    displayText: text.slice(0, visibleChars),
    isDone: visibleChars >= text.length,
  };
}
