import Image from "next/image";

// Two overlapping photos with distinct, deliberately different frame
// treatments — a tilted white "polaroid" card for the square shot, a
// thick gradient-ring "medallion" for the circular one — plus a few thin
// decorative swirl lines behind them. Reuses the same two collage photos
// already saved for the hero section rather than introducing new assets.
export function CtaPhotoCluster() {
  return (
    <div className="relative mx-auto hidden h-96 w-[26rem] shrink-0 sm:block">
      <svg
        className="pointer-events-none absolute -right-10 -bottom-10 size-64 text-white/25"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
      >
        <path d="M8 68 C 40 92, 68 38, 96 54" stroke="currentColor" strokeWidth="1" />
        <path d="M14 80 C 46 98, 74 48, 99 64" stroke="currentColor" strokeWidth="1" />
        <path d="M2 58 C 34 84, 62 28, 90 44" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* Square photo: tilted white "polaroid" frame */}
      <div className="absolute top-4 left-4 -rotate-6 rounded-2xl bg-white p-2.5 shadow-2xl">
        <div className="relative h-48 w-52 overflow-hidden rounded-xl">
          <Image src="/marketing/landing-collage-reports.jpg" alt="" aria-hidden fill className="object-cover" />
        </div>
      </div>

      {/* Circular photo: thick gradient-ring "medallion" frame */}
      <div className="absolute right-0 bottom-0 rounded-full bg-gradient-to-br from-white via-sky-200 to-white p-2 shadow-2xl">
        <div className="relative size-60 overflow-hidden rounded-full ring-1 ring-black/5">
          <Image
            src="/marketing/landing-collage-stethoscope-icons.jpg"
            alt=""
            aria-hidden
            fill
            className="object-cover"
          />
        </div>
      </div>
    </div>
  );
}
