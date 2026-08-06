/**
 * Pre-paint theme boot, shared verbatim by both root layouts ([locale] and
 * the global 404): apply the saved theme before first paint — warm paper
 * (light) is the default; a stored choice wins, otherwise the OS preference.
 * Contract: localStorage 'fhfs-theme' + data-theme + the 'fhfs:theme' event.
 *
 * Must be inlined as a raw <script> — see the note where the layouts use it.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("fhfs-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;
