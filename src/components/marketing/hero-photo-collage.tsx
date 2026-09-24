import Image from "next/image";

// Reuses the single real hero photo asset (there's no separate stock photo
// set for a 3-photo collage in this repo) at two different crop positions
// so the two photo tiles read as distinct shots rather than one image
// obviously repeated, alongside two purely decorative CSS shapes — same
// asymmetric collage composition as the reference design. Each piece fades
///slides in with an increasing animation-delay (see @keyframes collage-in
// in globals.css) so they land on screen one after another instead of all
// at once.
export function HeroPhotoCollage({ photoAlt }: { photoAlt: string }) {
  return (
    <div className="relative mx-auto aspect-[6/5] w-full max-w-lg">
      <div
        className="absolute top-0 left-0 size-16 rounded-full bg-gradient-to-br from-teal-300 to-teal-500 opacity-0 shadow-lg [animation:collage-in_0.7s_ease-out_forwards]"
        style={{ animationDelay: "0ms" }}
        aria-hidden
      />
      <div
        className="absolute top-14 left-6 h-24 w-32 rounded-2xl bg-gradient-to-br from-blue-500 to-primary opacity-0 shadow-lg [animation:collage-in_0.7s_ease-out_forwards]"
        style={{ animationDelay: "160ms" }}
        aria-hidden
      />

      <div
        className="absolute top-0 right-0 h-[70%] w-[62%] overflow-hidden rounded-3xl opacity-0 shadow-xl [animation:collage-in_0.7s_ease-out_forwards]"
        style={{ animationDelay: "320ms" }}
      >
        <Image src="/marketing/landing-hero-photo.png" alt={photoAlt} fill className="object-cover" priority />
      </div>

      <div
        className="absolute bottom-0 left-0 h-[46%] w-[52%] overflow-hidden rounded-3xl opacity-0 shadow-xl [animation:collage-in_0.7s_ease-out_forwards]"
        style={{ animationDelay: "480ms" }}
      >
        <Image
          src="/marketing/landing-hero-photo.png"
          alt=""
          aria-hidden
          fill
          className="object-cover object-bottom"
        />
      </div>
    </div>
  );
}
