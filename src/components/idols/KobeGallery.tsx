import Image from "next/image";
import { Reveal } from "@/components/fx/Reveal";
import type { KobePhoto } from "./kobePhotos";

export type GalleryPhoto = KobePhoto & { title: string; meta: string; alt: string };

/**
 * The photographs, hung in columns at their own proportions — a portrait
 * stays a portrait. Under each: what it is, when, and who took it under
 * what terms, because every one of these is someone else's picture.
 */
export function KobeGallery({ photos }: { photos: GalleryPhoto[] }) {
  return (
    <Reveal as="div" stagger={0.06} className="columns-2 gap-4 md:columns-3 md:gap-5">
      {photos.map((photo, i) => (
        <figure key={photo.id} className="mb-4 break-inside-avoid md:mb-5">
          <Image
            src={`/idols/kobe/${photo.file}`}
            width={photo.width}
            height={photo.height}
            alt={photo.alt}
            sizes="(min-width: 768px) 340px, 50vw"
            // The first two are above the fold on a phone.
            fetchPriority={i < 2 ? "high" : undefined}
            className="w-full rounded-card bg-surface"
          />
          <figcaption className="mt-2">
            <p className="text-caption text-fg">
              {photo.title}
              <span className="text-fg-tertiary"> · {photo.meta}</span>
            </p>
            <p className="font-mono text-[0.6875rem] leading-relaxed text-fg-tertiary">
              <a href={photo.page} rel="noreferrer" target="_blank" className="hover:text-accent">
                {photo.author} · {photo.licence}
              </a>
            </p>
          </figcaption>
        </figure>
      ))}
    </Reveal>
  );
}
