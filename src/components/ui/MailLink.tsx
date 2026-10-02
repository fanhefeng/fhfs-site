"use client";

import { useEffect, useRef, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

/** How long a mail program has to take the page's focus before the reader is
 *  told the address was copied instead. */
const HANDOFF_MS = 800;
/** How long the notice stays; longer when the copy failed and the address on
 *  the chip is all the reader has. */
const NOTICE_MS = 2600;
const NOTICE_MANUAL_MS = 6000;

/**
 * Resolves true if, within `ms`, something took the reader away from the page —
 * which is all a mailto: handed to a mail program looks like from in here: the
 * app comes forward (the window blurs), a phone switches apps (the page is
 * hidden), or a webmail the browser registered takes the tab (pagehide). The
 * browser says nothing about whether a mailto: went anywhere, and when it went
 * nowhere it says nothing at all — a Mac whose mail app is Chrome, in a Chrome
 * profile with no webmail registered, is that case.
 */
function handedOff(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timer = 0;
    const finish = (gone: boolean) => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", away);
      window.removeEventListener("pagehide", away);
      document.removeEventListener("visibilitychange", away);
      resolve(gone);
    };
    const away = () => finish(true);
    window.addEventListener("blur", away);
    window.addEventListener("pagehide", away);
    document.addEventListener("visibilitychange", away);
    timer = window.setTimeout(() => finish(document.hidden || !document.hasFocus()), ms);
  });
}

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { email: string };

/**
 * A mailto: link that still answers when there is no mail program to open.
 *
 * The click copies the address and lets the browser hand the mailto: on as
 * usual. The copy happens at the click, not after the wait: Safari only lets a
 * page write the clipboard inside the gesture. If the page still has the
 * reader's focus once the wait is over, nothing took it, and a chip at the foot
 * of the screen says the address is on the clipboard — the same glass chip as
 * the article menu's "link copied" (DESIGN-LOG, 09-18). When a mail program did
 * open, nothing is said; the address is on the clipboard all the same.
 *
 * The chip is portalled to <body>: RouteTransition scales <main> on a reveal,
 * and a transformed ancestor would pin a fixed chip to it. Once shown it stays
 * mounted, empty of pointer events, so leaving is a fade with the words still
 * in it and showing again is a transition rather than a remount. One timer
 * chain at a time — a second click restarts the wait instead of stacking.
 */
export function MailLink({ email, onClick, children, ...rest }: Props) {
  const t = useTranslations("common");
  const [notice, setNotice] = useState<{ copied: boolean } | null>(null);
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  /** Bumped by every click and by unmount, so an answer that arrives after a
   *  newer click, or after the page has gone, is dropped. */
  const run = useRef(0);
  useEffect(
    () => () => {
      run.current += 1;
      window.clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    const id = ++run.current;
    window.clearTimeout(timer.current);
    setShown(false);
    const copy =
      navigator.clipboard?.writeText(email).then(
        () => true,
        () => false,
      ) ?? Promise.resolve(false);
    void Promise.all([copy, handedOff(HANDOFF_MS)]).then(([copied, gone]) => {
      if (id !== run.current || gone) return;
      setNotice({ copied });
      setShown(true);
      timer.current = window.setTimeout(
        () => setShown(false),
        copied ? NOTICE_MS : NOTICE_MANUAL_MS,
      );
    });
  };

  const message = notice ? t(notice.copied ? "mailCopied" : "mailAddress") : "";

  return (
    <>
      <a href={`mailto:${email}`} onClick={handleClick} {...rest}>
        {children}
      </a>
      <span aria-live="polite" className="sr-only">
        {shown ? `${message} ${email}` : ""}
      </span>
      {notice
        ? createPortal(
            <span
              aria-hidden="true"
              className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[90] flex justify-center px-6 print:hidden"
            >
              <span
                className={`glass-thin flex max-w-full flex-wrap items-baseline justify-center gap-x-2 rounded-chip px-3.5 py-2 text-caption text-fg transition-[opacity,translate] duration-300 ease-out starting:translate-y-1 starting:opacity-0 ${
                  shown ? "opacity-100" : "translate-y-1 opacity-0"
                } ${notice.copied ? "" : shown ? "pointer-events-auto select-all" : ""}`}
              >
                {message}
                <span className="font-mono text-fg-secondary">{email}</span>
              </span>
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
