"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "@/lib/gsap";
import { Link } from "@/i18n/navigation";

export type DockItem = {
  href: string;
  label: string;
  glyph: ReactNode;
  active?: boolean;
};

type Props = {
  mark: ReactNode;
  markHref: string;
  markLabel: string;
  items: DockItem[];
  ariaLabel: string;
  /** Fired on a click, with the pointer's page coordinates. */
  onBurst?: (x: number, y: number) => void;
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

type Mag = { el: HTMLElement; w: number; h: number; v: number; vel: number; target: number };
type Spec = { el: HTMLElement; ang: number; tAng: number; br: number; tBr: number; focused: boolean; reach: number };

/**
 * A floating dock: pills that magnify as the pointer nears them, over a rim
 * highlight that points back at where the pointer is.
 *
 * Both are springs and both run off one ticker. Both switch off for a coarse
 * pointer — a dock that magnifies on touch just reads as broken, because there
 * is no hover to anticipate the tap.
 *
 * Every layout read happens inside the frame, never in the pointer handler:
 * the items resize as they grow, so their rects have to be re-read, and doing
 * that per pointermove forces a synchronous layout several times a frame. The
 * handler only records where the pointer is.
 */
export function NavDock({ mark, markHref, markLabel, items, ariaLabel, onBurst }: Props) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const fine = () =>
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    const mags: Mag[] = Array.from(root.querySelectorAll<HTMLElement>("[data-dock]")).map((el) => ({
      el, w: 0, h: 0, v: 0, vel: 0, target: 0,
    }));
    const specs: Spec[] = Array.from(document.querySelectorAll<HTMLElement>("[data-spec]")).map((el) => ({
      el, ang: 2.4, tAng: 2.4, br: 0, tBr: 0, focused: false,
      reach: el.classList.contains("gh-dock") ? 250 : 185,
    }));

    let on = fine();
    let live = false;
    let key = false;
    let dockDirty = true;
    let specDirty = true;
    let unit = 1;
    let aimX = 0, aimY = 0, aimSeen = false, aimMoved = false;

    const measure = () => {
      on = fine();
      const stage = document.querySelector<HTMLElement>(".gh-stage");
      unit = stage ? stage.getBoundingClientRect().width / (window.matchMedia("(max-width: 900px)").matches ? 760 : 1600) : 1;
      for (const st of mags) {
        st.el.style.width = st.el.style.height = st.el.style.transform = "";
        st.el.dataset.near = "false";
        st.v = st.vel = st.target = 0;
      }
      for (const st of mags) {
        const r = st.el.getBoundingClientRect();
        st.w = r.width;
        st.h = r.height;
      }
      live = false;
      dockDirty = true;
      aimMoved = aimSeen;
    };

    const rest = () => {
      live = false;
      dockDirty = true;
      for (const st of mags) {
        st.target = 0;
        st.el.dataset.near = "false";
      }
    };

    const drawDock = (dt: number) => {
      if (!on) return;
      /* Targets are only recomputed when the pointer actually MOVES.
         Re-deriving them every frame from a stale position oscillates: the
         capsule is centred, so a growing pill shifts the whole bar sideways,
         which slides a different pill under a stationary cursor, which grows
         instead, which shifts it back. And whichever input moved last owns the
         dock, or the pointer's last position re-targets over keyboard focus
         and focus never takes. */
      if (aimSeen && aimMoved && !key) {
        const rr = root.getBoundingClientRect();
        // the catch box reaches well below the bar, because that is where the
        // pills grow to and the pointer has to be able to follow them
        if (aimX > rr.left - 48 && aimX < rr.right + 48 && aimY > rr.top - 44 && aimY < rr.bottom + 104) {
          for (const st of mags) {
            const r = st.el.getBoundingClientRect();
            const prox = clamp01(1 - Math.abs(aimX - (r.left + r.width * 0.5)) / (128 * unit));
            st.target = prox * prox * (3 - 2 * prox);
            st.el.dataset.near = st.target > 0.08 ? "true" : "false";
          }
          live = true;
          dockDirty = true;
        } else if (live) rest();
      }

      if (!dockDirty) return;
      let moving = false;
      for (const st of mags) {
        st.vel += (st.target - st.v) * 190 * dt;
        st.vel *= Math.exp(-23 * dt);
        st.v += st.vel * dt;
        if (Math.abs(st.target - st.v) < 0.001 && Math.abs(st.vel) < 0.004) { st.v = st.target; st.vel = 0; }
        else moving = true;

        const v = Math.min(Math.max(st.v, 0), 1.08);
        const isMark = st.el.classList.contains("gh-dock-mark");
        const ew = isMark ? 14 * unit : Math.min(18 * unit, st.w * 0.24);
        const eh = isMark ? 14 * unit : 16 * unit;
        st.el.style.width = `${(st.w + ew * v).toFixed(2)}px`;
        st.el.style.height = `${(st.h + eh * v).toFixed(2)}px`;
        st.el.style.transform = `translateY(${(v * 3.5 * unit).toFixed(2)}px)`;
      }
      if (!moving) dockDirty = false;
    };

    const drawSpec = (dt: number) => {
      if (!on) return;
      if (aimSeen && aimMoved) {
        for (const st of specs) {
          const r = st.el.getBoundingClientRect();
          const cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.5;
          const dx = Math.max(r.left - aimX, 0, aimX - r.right);
          const dy = Math.max(r.top - aimY, 0, aimY - r.bottom);
          const d = Math.sqrt(dx * dx + dy * dy);
          // inside the box there is no direction to point at, so bias off the
          // corner and let the offset from centre steer it
          st.tAng =
            d === 0
              ? Math.atan2(2 / Math.max(r.height, 1), -2 / Math.max(r.width, 1)) +
                ((aimX - cx) / Math.max(r.width * 0.5, 1)) * 0.3 +
                ((cy - aimY) / Math.max(r.height * 0.5, 1)) * 0.15
              : Math.atan2(cy - aimY, aimX - cx);
          const raw = clamp01(1 - d / (st.reach * unit));
          st.tBr = Math.max(raw * raw * (3 - 2 * raw), st.focused ? 0.9 : 0);
        }
        specDirty = true;
      }

      if (!specDirty) return;
      let moving = false;
      for (const st of specs) {
        const diff = ((st.tAng - st.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        st.ang += diff * (1 - Math.exp(-dt * 8));
        st.br += (st.tBr - st.br) * (1 - Math.exp(-dt * 9));
        if (Math.abs(diff) < 0.001 && Math.abs(st.tBr - st.br) < 0.002) { st.ang = st.tAng; st.br = st.tBr; }
        else moving = true;
        st.el.style.setProperty("--spec-angle", `${st.ang.toFixed(4)}rad`);
        st.el.style.setProperty("--spec-bright", (clamp01(st.br) * 0.92).toFixed(3));
      }
      if (!moving) specDirty = false;
    };

    const tick = (_t: number, deltaMs: number) => {
      const dt = Math.min(deltaMs / 1000, 0.05);
      drawDock(dt);
      drawSpec(dt);
      aimMoved = false;
    };

    measure();
    // the labels set the pill widths, so the base measure is wrong until the
    // real face has landed
    document.fonts?.ready.then(measure).catch(() => {});
    window.addEventListener("resize", measure);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      aimX = e.clientX;
      aimY = e.clientY;
      aimSeen = true;
      aimMoved = true;
      key = false;
      dockDirty = specDirty = true;
    };
    const onLeave = () => {
      aimSeen = false;
      rest();
      for (const st of specs) st.tBr = st.focused ? 0.9 : 0;
      specDirty = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);

    // keyboard gets the same magnification, centred on the focused pill
    const onFocusIn = (e: FocusEvent) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>("[data-dock]");
      if (!item || !on) return;
      const idx = mags.findIndex((st) => st.el === item);
      mags.forEach((st, i) => {
        st.target = i === idx ? 1 : Math.abs(i - idx) === 1 ? 0.24 : 0;
        st.el.dataset.near = st.target > 0.08 ? "true" : "false";
      });
      live = false;
      key = true;
      dockDirty = true;
    };
    const onFocusOut = () => {
      requestAnimationFrame(() => {
        if (!root.contains(document.activeElement)) { key = false; rest(); }
      });
    };
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);

    const specFocus: Array<[Spec, () => void, () => void]> = specs.map((st) => {
      const fin = () => { st.focused = true; specDirty = true; };
      const fout = () => { st.focused = false; specDirty = true; };
      st.el.addEventListener("focusin", fin);
      st.el.addEventListener("focusout", fout);
      return [st, fin, fout];
    });

    // the pill throws a handful of pollen off itself — the hero already has an
    // emitter for that, and asking for it by event keeps them uncoupled
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-dock]")) return;
      onBurst?.(e.clientX, e.clientY);
    };
    root.addEventListener("click", onClick);

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("click", onClick);
      for (const [st, fin, fout] of specFocus) {
        st.el.removeEventListener("focusin", fin);
        st.el.removeEventListener("focusout", fout);
      }
    };
  }, [onBurst]);

  return (
    <div className="gh-dock-wrap">
      <nav ref={rootRef} className="gh-dock par" style={{ "--pd": 5 } as React.CSSProperties} data-spec aria-label={ariaLabel}>
        <Link className="gh-dock-item gh-dock-mark" data-dock data-spec href={markHref} style={{ "--d": "120ms" } as React.CSSProperties} aria-label={markLabel}>
          {mark}
        </Link>
        {items.map((item, i) => (
          <Link
            key={item.href}
            className={`gh-dock-item${item.active ? " is-active" : ""}`}
            data-dock
            data-spec
            href={item.href}
            style={{ "--d": `${180 + i * 50}ms` } as React.CSSProperties}
          >
            <span className="gh-glyph" aria-hidden="true">{item.glyph}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
