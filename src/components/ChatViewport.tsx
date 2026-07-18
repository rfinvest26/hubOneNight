import { ReactNode, RefObject, useEffect } from 'react';
import { ArrowDown } from 'lucide-react';

interface Props {
  header: ReactNode;
  composer: ReactNode;
  children: ReactNode;
  scrollRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  onScroll: () => void;
  hasNewMessages?: boolean;
  onShowLatest?: () => void;
}

function installVisualViewportContract() {
  const root = document.documentElement;
  const body = document.body;
  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      root.style.setProperty('--chat-viewport-height', `${Math.round(viewport?.height ?? window.innerHeight)}px`);
      root.style.setProperty('--chat-viewport-top', `${Math.round(viewport?.offsetTop ?? 0)}px`);
    });
  };
  root.classList.add('chat-page-open');
  body.classList.add('chat-page-open');
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
    root.classList.remove('chat-page-open');
    body.classList.remove('chat-page-open');
    root.style.removeProperty('--chat-viewport-height');
    root.style.removeProperty('--chat-viewport-top');
  };
}

export default function ChatViewport({
  header,
  composer,
  children,
  scrollRef,
  contentRef,
  onScroll,
  hasNewMessages = false,
  onShowLatest,
}: Props) {
  useEffect(installVisualViewportContract, []);

  return (
    <section className="chat-viewport" aria-label="Чат">
      {header}
      <div className="chat-stage">
        <div className="chat-panel">
          <div ref={scrollRef} onScroll={onScroll} className="chat-scroll-region">
            <div ref={contentRef} className="chat-message-column">
              {children}
            </div>
          </div>
          {hasNewMessages && onShowLatest && (
            <button type="button" onClick={onShowLatest} className="chat-latest-button">
              <ArrowDown size={15} /> Новые сообщения
            </button>
          )}
          <div className="chat-composer-region">{composer}</div>
        </div>
      </div>
    </section>
  );
}
