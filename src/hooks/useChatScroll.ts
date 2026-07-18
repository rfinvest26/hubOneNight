import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const BOTTOM_THRESHOLD = 96;

/** Keep chat autoscroll predictable: follow new messages only while the user
 * is already near the bottom, otherwise expose a deliberate return button. */
export function useChatScroll(messageCount: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const previousCountRef = useRef(0);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const node = scrollRef.current;
    if (!node) return;
    nearBottomRef.current = true;
    setHasNewMessages(false);
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight <= BOTTOM_THRESHOLD;
    nearBottomRef.current = nearBottom;
    if (nearBottom) setHasNewMessages(false);
  }, []);

  useLayoutEffect(() => {
    const previousCount = previousCountRef.current;
    const firstLoad = previousCount === 0;
    if (firstLoad || nearBottomRef.current) {
      scrollToBottom(firstLoad ? 'auto' : 'smooth');
    } else if (messageCount > previousCount) {
      setHasNewMessages(true);
    }
    previousCountRef.current = messageCount;
  }, [messageCount, scrollToBottom]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (nearBottomRef.current) scrollToBottom('auto');
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  return { scrollRef, contentRef, handleScroll, scrollToBottom, hasNewMessages };
}
