import { useState, useEffect, useRef } from "react";
import type { MarqueeMessage } from "@/components/menus";

interface TypewriterState {
  index: number;
  visibleChars: number;
}

export interface TypewriterResult {
  displayText: string;
  ctaLabel: string;
  ctaUrl: string;
  isDone: boolean;
}

const INTER_MESSAGE_PAUSE = 500;

export function useTypewriter(
  messages: MarqueeMessage[],
  charDelay = 40,
  startDelay = 600,
  displayTime = 3000,
): TypewriterResult {
  const [state, setState] = useState<TypewriterState>({ index: 0, visibleChars: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const messagesRef = useRef(messages);
  const charDelayRef = useRef(charDelay);
  const displayTimeRef = useRef(displayTime);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { charDelayRef.current = charDelay; }, [charDelay]);
  useEffect(() => { displayTimeRef.current = displayTime; }, [displayTime]);

  useEffect(() => {
    const msgs = messages || [];
    if (msgs.length === 0) return;

    cancelledRef.current = false;
    let currentIndex = 0;

    const getFullText = () => {
      const msg = messagesRef.current[currentIndex];
      if (!msg) return "";
      return msg.text + (msg.cta_label || "");
    };

    const scheduleType = (chars: number, delay: number) => {
      if (cancelledRef.current) return;
      timerRef.current = setTimeout(() => {
        if (cancelledRef.current) return;
        const fullText = getFullText();
        const next = chars + 1;
        setState({ index: currentIndex, visibleChars: next });
        if (next >= fullText.length) {
          scheduleErase(next, displayTimeRef.current);
        } else {
          scheduleType(next, charDelayRef.current);
        }
      }, delay);
    };

    const scheduleErase = (chars: number, delay: number) => {
      if (cancelledRef.current) return;
      timerRef.current = setTimeout(() => {
        if (cancelledRef.current) return;
        const next = chars - 1;
        setState({ index: currentIndex, visibleChars: next });
        if (next <= 0) {
          currentIndex = (currentIndex + 1) % messagesRef.current.length;
          setState({ index: currentIndex, visibleChars: 0 });
          scheduleType(0, INTER_MESSAGE_PAUSE);
        } else {
          scheduleErase(next, Math.floor(charDelayRef.current / 2));
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
  }, [(messages || []).length, startDelay]);

  const safeMessages = (messages && messages.length > 0) ? messages : [{ text: "" }];
  const msg = safeMessages[Math.min(state.index, safeMessages.length - 1)] || { text: "" };
  const fullText = (msg.text || "") + (msg.cta_label || "");
  const displayFull = fullText.slice(0, state.visibleChars);
  const textLen = (msg.text || "").length;
  const displayText = displayFull.slice(0, Math.min(state.visibleChars, textLen));
  const ctaVisible = state.visibleChars > textLen ? displayFull.slice(textLen) : "";

  return {
    displayText,
    ctaLabel: ctaVisible,
    ctaUrl: msg.cta_url || "",
    isDone: state.visibleChars >= fullText.length,
  };
}
