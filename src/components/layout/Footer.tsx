"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";

/* Brightness ramp, dark → bright (15 steps, same as the reference demo). */
const CHARS = " .,:;i1tfLCG08@";
const CELL_W = 9;
const CELL_H = 15;
/* Cursor influence radius, in character cells. */
const CURSOR_R = 7.5;

/* Theme colors for the ASCII pipeline, read once from CSS variables and
 * refreshed on the "fhfs:theme" event — never queried per frame. */
type AsciiTheme = {
  /** Stage floor / source canvas background (CSS color). */
  bg: string;
  /** Base glyph color as "r,g,b" (alpha appended per cell). */
  ink: string;
  /** Cursor-cluster highlight as "r,g,b". */
  hi: string;
  /** Sign glow pass color. */
  sign: string;
  /** Sign solid pass color. */
  solid: string;
  /** Vinyl silhouette color. */
  gold: string;
  /** Light theme paints ink on paper, so luminance must be inverted. */
  invert: boolean;
};

const hexToRgb = (hex: string, fallback: string): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

const readAsciiTheme = (): AsciiTheme => {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    bg: v("--finale-bg") || "#0b0b18",
    ink: hexToRgb(v("--muted-fg"), "154,148,184"),
    hi: hexToRgb(v("--neon-blue"), "76,201,240"),
    sign: v("--neon-red") || "#ff4d6d",
    solid: v("--fg") || "#f5f0e8",
    gold: v("--gold") || "#e8b44f",
    invert: document.documentElement.dataset.theme === "light",
  };
};

const NAV_ITEMS = [
  { href: "/blog", key: "blog" },
  { href: "/about", key: "about" },
  { href: "/portfolio", key: "portfolio" },
  { href: "/software", key: "software" },
] as const;

/**
 * "FINALE" — the site-wide footer as the closing act of the show.
 * The background is not an image: an offscreen canvas paints the neon
 * sign name (plus a gold vinyl silhouette), gets sampled once per resize
 * into a luminance grid, and the main canvas redraws it every frame as
 * ASCII characters. The cursor brightens nearby glyphs in a pulsing
 * cluster; scrolling into the footer reveals the picture row by row.
 */
export function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const locale = useLocale();

  const containerRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(false);

  /* Track prefers-reduced-motion in state so the JSX can render the
     static variants (no link roll, no will-change) without GSAP. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useGSAP(
    (_context, contextSafe) => {
      const footer = containerRef.current;
      const cvs = canvasRef.current;
      const ctx = cvs?.getContext("2d");
      if (!footer || !cvs || !ctx || !contextSafe) return;

      /* ---------- ASCII pipeline state (all plain closure vars) ---------- */
      let cols = 0;
      let rows = 0;
      let dpr = 1;
      let lum: Float32Array | null = null;
      /* Cached canvas rect — refreshed on resize/scroll via rAF, never
         queried inside pointermove or the render loop. */
      const rect = { left: 0, top: 0 };
      const mouse = { x: -9999, y: -9999, on: 0 };
      /* Scroll-driven reveal progress; forced to 1 under reduced motion. */
      const state = { reveal: 0 };
      /* Night show or matinee — refreshed on the pull-cord event. */
      let theme = readAsciiTheme();

      /* Offscreen "poster" we rasterize the sign name into (per resize). */
      const source = document.createElement("canvas");
      const srcCtx = source.getContext("2d");
      /* Tiny cols×rows canvas used only to read luminance once per resize. */
      const sampler = document.createElement("canvas");
      const smpCtx = sampler.getContext("2d", { willReadFrequently: true });
      if (!srcCtx || !smpCtx) return;

      /* Paint the ASCII source in theme colors: night — glowing sign on a
         dark stage; matinee — ink lettering on warm paper (the sampler
         inverts luminance so the picture reads the same either way). */
      const drawSource = (w: number, h: number) => {
        source.width = w;
        source.height = h;
        srcCtx.fillStyle = theme.bg;
        srcCtx.fillRect(0, 0, w, h);

        srcCtx.textAlign = "center";
        srcCtx.textBaseline = "middle";
        srcCtx.font = `900 ${Math.floor(h * 0.55)}px Georgia, 'Songti SC', serif`;

        /* Two glow passes (shadow does the halo), then one solid pass. */
        srcCtx.shadowColor = theme.sign;
        srcCtx.shadowBlur = h * 0.12;
        srcCtx.fillStyle = theme.sign;
        srcCtx.fillText(site.signName, w / 2, h / 2);
        srcCtx.fillText(site.signName, w / 2, h / 2);
        srcCtx.shadowBlur = 0;
        srcCtx.fillStyle = theme.solid;
        srcCtx.fillText(site.signName, w / 2, h / 2);

        /* Gold record silhouette: filled disc, then punch the spindle
           hole by repainting the background color over the center. */
        const cx = w * 0.82;
        const cy = h * 0.22;
        const r = Math.min(w, h) * 0.16;
        srcCtx.globalAlpha = 0.5;
        srcCtx.fillStyle = theme.gold;
        srcCtx.beginPath();
        srcCtx.arc(cx, cy, r, 0, Math.PI * 2);
        srcCtx.fill();
        srcCtx.globalAlpha = 1;
        srcCtx.fillStyle = theme.bg;
        srcCtx.beginPath();
        srcCtx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
        srcCtx.fill();
      };

      /* Downsample the source to cols×rows and cache one luminance value
         per cell. getImageData runs here only — never per frame. */
      const sample = () => {
        if (!cols || !rows || !source.width || !source.height) return;
        sampler.width = cols;
        sampler.height = rows;

        /* Cover-fit the source into the grid (kept from the demo so the
           picture never distorts even if aspect ratios drift). */
        const ir = source.width / source.height;
        const cr = cols / rows;
        let sw = source.width;
        let sh = source.height;
        let sx = 0;
        let sy = 0;
        if (ir > cr) {
          sw = sh * cr;
          sx = (source.width - sw) / 2;
        } else {
          sh = sw / cr;
          sy = (source.height - sh) / 2;
        }
        smpCtx.clearRect(0, 0, cols, rows);
        smpCtx.drawImage(source, sx, sy, sw, sh, 0, 0, cols, rows);

        const data = smpCtx.getImageData(0, 0, cols, rows).data;
        lum = new Float32Array(cols * rows);
        for (let i = 0; i < cols * rows; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          /* Rec.709 luminance + contrast stretch so the ASCII picture
             doesn't collapse into a mid-gray mush. Matinee sources are
             ink-on-paper, so flip luminance to keep "bright = glyph". */
          let v = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          if (theme.invert) v = 1 - v;
          v = Math.min(1, Math.max(0, (v - 0.12) * 1.5));
          lum[i] = v;
        }
      };

      /* rAF-throttled rect cache refresh (resize + scroll). */
      let rectRaf = 0;
      const refreshRect = () => {
        if (rectRaf) return;
        rectRaf = requestAnimationFrame(() => {
          rectRaf = 0;
          const r = cvs.getBoundingClientRect();
          rect.left = r.left;
          rect.top = r.top;
        });
      };

      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = cvs.clientWidth;
        const h = cvs.clientHeight;
        cvs.width = Math.floor(w * dpr);
        cvs.height = Math.floor(h * dpr);
        cols = Math.max(1, Math.floor(w / CELL_W));
        rows = Math.max(1, Math.floor(h / CELL_H));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = `${CELL_H - 2}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textBaseline = "top";
        drawSource(w, h);
        sample();
        refreshRect();
      };

      const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

      /* Per-frame draw: luminance + cursor distance → glyph + color.
         No layout reads, no image reads — just the cached Float32Array. */
      const render = (tSec: number) => {
        if (!lum) return;
        const w = cvs.clientWidth;
        const h = cvs.clientHeight;
        ctx.clearRect(0, 0, w, h);

        const mCol = mouse.x / CELL_W;
        const mRow = mouse.y / CELL_H;

        for (let y = 0; y < rows; y++) {
          /* Row-by-row reveal: lower rows surface first. */
          const rowProgress = clamp01(
            (state.reveal - (1 - y / rows) * 0.35) / 0.65
          );
          if (rowProgress <= 0.001) continue;

          for (let x = 0; x < cols; x++) {
            const v = lum[y * cols + x];
            if (v <= 0.02) continue;

            /* Cursor ripple: squared falloff plus a slow time ring so the
               highlighted cluster itself keeps breathing. */
            let boost = 0;
            if (mouse.on > 0) {
              const dx = x - mCol;
              const dy = y - mRow;
              const d = Math.sqrt(dx * dx + dy * dy);
              if (d < CURSOR_R) {
                const falloff = 1 - d / CURSOR_R;
                boost =
                  falloff *
                  falloff *
                  mouse.on *
                  (0.75 + 0.25 * Math.sin(d * 1.4 - tSec * 3.4));
              }
            }

            const vv = Math.min(
              1,
              v * (0.55 + 0.45 * rowProgress) + boost * 0.85
            );
            const ci = Math.min(CHARS.length - 1, Math.floor(vv * CHARS.length));
            const ch = CHARS[ci];
            if (ch === " ") continue;

            if (boost > 0.06) {
              /* Neon-blue highlighted cluster under the cursor. */
              const a = Math.min(1, 0.45 + boost);
              ctx.fillStyle = `rgba(${theme.hi},${a.toFixed(3)})`;
            } else {
              const a = 0.14 + vv * 0.5 * rowProgress;
              ctx.fillStyle = `rgba(${theme.ink},${a.toFixed(3)})`;
            }
            ctx.fillText(ch, x * CELL_W, y * CELL_H);
          }
        }
      };

      /* ---------- render loop, gated by viewport visibility ---------- */
      let ticking = false;
      const tick = (time: number) => render(time);
      const io = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !ticking) {
          ticking = true;
          gsap.ticker.add(tick);
        } else if (!entry.isIntersecting && ticking) {
          ticking = false;
          gsap.ticker.remove(tick);
        }
      });
      io.observe(footer);

      /* ---------- pointer events ---------- */
      const onPointerMove = (e: PointerEvent) => {
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
      };
      /* Ease the cursor influence in/out so the cluster never pops. */
      const onPointerEnter = contextSafe(() => {
        gsap.to(mouse, { on: 1, duration: 0.5, overwrite: "auto" });
      });
      const onPointerLeave = contextSafe(() => {
        gsap.to(mouse, { on: 0, duration: 0.8, overwrite: "auto" });
      });
      /* resize() re-rasterises a heavily blurred wordmark and re-runs
         getImageData over the whole grid — far too expensive to do on
         every event of a window drag, so settle first. */
      let resizeTimer = 0;
      const onResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(resize, 150);
      };

      /* Pull-cord flips: re-read the palette, repaint the source poster in
         the new colors and resample — cheap, and only on the event. */
      const onTheme = () => {
        theme = readAsciiTheme();
        drawSource(cvs.clientWidth, cvs.clientHeight);
        sample();
      };

      footer.addEventListener("pointermove", onPointerMove);
      footer.addEventListener("pointerenter", onPointerEnter);
      footer.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", refreshRect, { passive: true });
      window.addEventListener("fhfs:theme", onTheme);

      /* ---------- motion preference split ---------- */
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        /* Static but complete: full ASCII picture, no entrance tweens.
           The cursor cluster stays — it is input-driven, not autonomous. */
        state.reveal = 1;
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        /* Scroll progress grows the characters from the bottom up. */
        ScrollTrigger.create({
          trigger: footer,
          start: "top 85%",
          end: "top 10%",
          onUpdate: (self) => {
            state.reveal = self.progress;
          },
        });

        /* Giant sign name: letters swing up one by one. */
        gsap.from(".finale-ch", {
          yPercent: 120,
          rotate: 8,
          opacity: 0,
          duration: 1.3,
          ease: "back.out(1.5)",
          stagger: { each: 0.04, from: "start" },
          scrollTrigger: { trigger: footer, start: "top 62%" },
        });
      });

      resize();

      return () => {
        footer.removeEventListener("pointermove", onPointerMove);
        footer.removeEventListener("pointerenter", onPointerEnter);
        footer.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", refreshRect);
        window.removeEventListener("fhfs:theme", onTheme);
        window.clearTimeout(resizeTimer);
        if (rectRaf) cancelAnimationFrame(rectRaf);
        io.disconnect();
        if (ticking) gsap.ticker.remove(tick);
      };
    },
    { scope: containerRef }
  );

  const backToTop = () => {
    if (window.__lenis) {
      window.__lenis.scrollTo(0);
    } else {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    }
  };

  /* Double-decker roll-up label for hover (CSS only); a plain
     color-transition label when reduced motion is preferred. */
  const rollLabel = (text: string) =>
    reduced ? (
      <span className="transition-colors group-hover:text-neon-blue">
        {text}
      </span>
    ) : (
      <span className="relative block overflow-hidden">
        <span className="block transition-transform duration-500 ease-out group-hover:-translate-y-full group-focus-visible:-translate-y-full">
          <span className="block">{text}</span>
          <span className="absolute left-0 top-full block text-neon-blue">
            {text}
          </span>
        </span>
      </span>
    );

  const linkClass =
    "group inline-block text-[17px] font-medium tracking-tight text-fg no-underline";
  const colHeadClass =
    "mb-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-fg";

  return (
    <footer
      ref={containerRef}
      className="relative mt-24 flex min-h-[88svh] flex-col justify-between overflow-hidden bg-[var(--finale-bg)] transition-colors duration-[350ms]"
    >
      {/* ASCII layer + veil that pushes it back so the copy stays legible */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(78%_62%_at_50%_44%,transparent_20%,rgba(var(--finale-veil),0.55)_72%,rgba(var(--finale-veil),0.9)_100%)]"
      />

      {/* Top: kicker + link columns + back-to-top */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-10 px-6 pt-16 sm:px-10">
        <p className="track-kicker">{t("finale")}</p>

        <div className="flex flex-wrap gap-12 sm:gap-20">
          <nav className="flex flex-col items-start gap-2.5">
            <span className={colHeadClass}>{t("colNav")}</span>
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass}>
                {rollLabel(tNav(item.key))}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col items-start gap-2.5">
            <span className={colHeadClass}>{t("colContact")}</span>
            <a
              href={site.social.github}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              {rollLabel("GitHub")}
            </a>
            <a href={`/${locale}/rss.xml`} className={linkClass}>
              {rollLabel(t("rss"))}
            </a>
            <button
              type="button"
              onClick={backToTop}
              className={`${linkClass} cursor-pointer text-left`}
            >
              {rollLabel(`↑ ${t("backToTop")}`)}
            </button>
          </div>
        </div>
      </div>

      {/* Giant sign name — one span per character for the swing-up entrance */}
      <div className="relative z-10 px-6 pb-6 sm:px-10">
        <h2
          aria-label={site.signName}
          className="flex flex-wrap font-sign leading-[0.9] text-neon-red"
          style={{ fontSize: "clamp(64px, 16vw, 240px)" }}
        >
          {Array.from(site.signName).map((c, i) => (
            <span
              key={`${c}-${i}`}
              aria-hidden="true"
              className={`finale-ch inline-block origin-bottom [text-shadow:var(--glow-red)] ${
                reduced ? "" : "will-change-transform"
              }`}
            >
              {c === " " ? " " : c}
            </span>
          ))}
        </h2>
      </div>

      {/* Bottom line */}
      <div className="relative z-10 mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-line py-5 font-mono text-[11px] text-muted-fg sm:mx-10">
        <span>
          {t("builtWith")}
          <span className="mx-2 opacity-40">·</span>
          <a
            href="https://sketchfab.com/3d-models/stylized-planet-789725db86f547fc9163b00f302c3e70"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-60 transition-opacity hover:opacity-100"
          >
            {t("planetCredit")}
          </a>
        </span>
        {/* The site is fully static: the build-time year is baked into the
            HTML, so let the client keep it rather than fail hydration on
            the first visit after New Year. */}
        <span suppressHydrationWarning>
          © {new Date().getFullYear()} {site.author} · {t("rights")}
        </span>
      </div>
    </footer>
  );
}
