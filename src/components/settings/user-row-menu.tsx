"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Mail, MoreHorizontal, Trash2 } from "lucide-react";

type Action = (form: FormData) => void | Promise<void>;

const ITEM = "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium hover:bg-slate-500/10 disabled:pointer-events-none disabled:opacity-50";

/**
 * The three-dot menu at the end of a user row: the actions used less often than role, client and Active.
 * It sits inside the row's form, so each item submits that row's id to its own server action. Removing asks first.
 * The list is a browser popover, so it is drawn above the page and is not cut off by the card around the table.
 */
export function UserRowMenu({ email, canResend, canRemove, resend, remove }: { email: string; canResend: boolean; canRemove: boolean; resend: Action; remove: Action }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);

  // The list is positioned once when it opens, so close it if the page moves underneath.
  useEffect(() => {
    const close = () => { if (list.current?.matches(":popover-open")) list.current.hidePopover(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, []);

  /** Puts the list under the button, or above it when there is no room below (the last rows of the table). */
  function place() {
    const r = button.current?.getBoundingClientRect();
    const el = list.current;
    if (!r || !el) return;
    const gap = 6, edge = 8, height = el.offsetHeight;
    const below = r.bottom + gap;
    const top = below + height <= window.innerHeight - edge ? below : Math.max(edge, r.top - gap - height);
    el.style.top = `${top}px`;
    el.style.right = `${Math.max(edge, window.innerWidth - r.right)}px`;
  }

  // The confirmation is taller than the menu, so place it again once it has been drawn.
  useLayoutEffect(() => { if (list.current?.matches(":popover-open")) place(); }, [confirming]);

  function onToggle(e: React.ToggleEvent<HTMLDivElement>) {
    if (e.newState !== "open") { setConfirming(false); return; }
    place();
  }

  return (
    <>
      <button ref={button} type="button" popoverTarget={id} aria-label={`More actions for ${email}`} title="More actions" className="field inline-flex h-8 w-8 shrink-0 items-center justify-center hover:bg-brand-pale">
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      <div ref={list} id={id} popover="auto" onToggle={onToggle} style={{ margin: 0, inset: "auto" }} className="glass-strong w-60 !rounded-xl p-1 text-ink">
        {canResend && <button formAction={resend} className={ITEM}><Mail className="h-3.5 w-3.5" aria-hidden />Resend Link</button>}
        {!confirming ? (
          <button type="button" disabled={!canRemove} onClick={() => setConfirming(true)} className={`${ITEM} text-red-700 dark:text-red-300`}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden />{canRemove ? "Remove User" : "Remove User (not yourself)"}
          </button>
        ) : (
          <div className="px-2.5 py-2 text-xs">
            <p className="font-medium">Remove {email}?</p>
            <p className="mt-1 text-slate-500">Their login and profile are deleted and they lose access at once. This cannot be undone.</p>
            <div className="mt-2 flex gap-2">
              <button formAction={remove} className="rounded-lg bg-red-600 px-2.5 py-1.5 font-semibold text-white hover:bg-red-700">Yes, Remove</button>
              <button type="button" onClick={() => setConfirming(false)} className="field px-2.5 py-1.5 font-medium">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
