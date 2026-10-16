import "client-only";

/** The public jukebox and admin previews share the same one-sound rule.
 * The jukebox's own element waits through `held`, so it may be excluded here. */
export function pauseOtherMedia(current: HTMLMediaElement, background?: HTMLMediaElement | null) {
  for (const media of document.querySelectorAll<HTMLMediaElement>("audio, video")) {
    if (media !== current && media !== background && !media.paused) media.pause();
  }
}
