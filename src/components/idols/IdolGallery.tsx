import Image from "next/image";
import { Reveal } from "@/components/fx/Reveal";
import type { IdolPhoto } from "@/lib/idols";

/** A photograph as the page hangs it: captions in its language, `src` already
 *  the address the browser fetches. */
export type GalleryPhoto = Omit<IdolPhoto, "title" | "meta" | "alt"> & {
  title: string;
  meta: string;
  alt: string;
};

/**
 * The photographs, hung in columns at their own proportions — a portrait
 * stays a portrait. Under each: what it is, when, and who took it under
 * what terms, because every one of these is someone else's picture.
 */
export function IdolGallery({ photos }: { photos: GalleryPhoto[] }) {
  return (
    <Reveal as="div" stagger={0.06} className="columns-2 gap-4 md:columns-3 md:gap-5">
      {photos.map((photo) => (
        <figure key={photo.id} className="mb-4 break-inside-avoid md:mb-5">
          <Image
            src={photo.src}
            width={photo.width}
            height={photo.height}
            alt={photo.alt}
            sizes="(min-width: 768px) 340px, 50vw"
            className="w-full rounded-card bg-surface"
          />
          <figcaption className="mt-2">
            <p className="text-caption text-fg">
              {photo.title}
              {photo.meta && <span className="text-fg-tertiary"> · {photo.meta}</span>}
            </p>
            {(photo.author || photo.licence) && (
              <p className="font-mono text-[0.6875rem] leading-relaxed text-fg-tertiary">
                {photo.page ? (
                  <a
                    href={photo.page}
                    rel="noreferrer"
                    target="_blank"
                    className="hover:text-accent"
                  >
                    {credit(photo)}
                  </a>
                ) : (
                  credit(photo)
                )}
              </p>
            )}
          </figcaption>
        </figure>
      ))}
    </Reveal>
  );
}

/** Who took it, under what terms — whichever of the two is written. */
const credit = (photo: GalleryPhoto) => [photo.author, photo.licence].filter(Boolean).join(" · ");
