/**
 * Pre-paint theme boot, shared verbatim by both root layouts ([locale] and
 * the global 404): apply the saved theme before first paint — warm paper
 * (light) is the default; a stored choice wins, otherwise the OS preference.
 * Contract: localStorage 'fhfs-theme' + data-theme + the 'fhfs:theme' event.
 *
 * It also stamps `data-js` on <html>: the "scripting is on" flag that CSS
 * keys pre-intro states off (`[data-js] .gh-hero .mask { clip-path: … }`), so
 * a page without JS renders finished rather than clipped away to nothing.
 * The flag lives here, not in the components that need it, because a
 * component's own inline <script> does not run when React creates it on the
 * client — a soft navigation into such a page would skip its intro entirely.
 * <html> mostly survives that navigation; a locale switch is the exception,
 * where React wipes the element's attributes clean and ThemeKeeper puts both
 * this flag and data-theme back.
 *
 * Must be inlined as a raw <script> — ThemeInitScript.tsx does that, and says
 * why it goes through a wrapper element rather than a React <script>.
 * The "fhfs-theme" literal is THEME_STORAGE_KEY in `lib/theme.ts`, repeated
 * here because an inline script cannot import.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;d.dataset.js="";try{var t=localStorage.getItem("fhfs-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.dataset.theme=t}catch(e){}})()`;
