import Image from "next/image";

// The four real reference photos, laid out as one seamless interlocking
// collage (CSS Grid, zero gap) rather than separate floating cards — only
// the outer silhouette corners are rounded, every shared inner edge between
// tiles stays square so adjacent photos read as one continuous puzzle-piece
// shape, matching the reference mockup exactly. Two decorative CSS shapes
// float separately to the left, not touching the photo grid. Left-column
// tiles slide in from the left, right-column tiles slide in from the right
// (see @keyframes collage-in-left / collage-in-right in globals.css), each
// with an increasing delay so the pieces appear to move into place side by
// side, one after another, instead of all appearing at once.
export function HeroPhotoCollage({
  altTexts,
}: {
  altTexts: [string, string, string, string];
}) {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div
        className="absolute top-0 left-0 z-10 size-14 rounded-full bg-gradient-to-br from-teal-300 to-teal-500 opacity-0 shadow-lg [animation:collage-in-left_0.7s_ease-out_forwards]"
        style={{ animationDelay: "0ms" }}
        aria-hidden
      />
      <div
        className="absolute top-12 left-2 z-10 h-20 w-28 rounded-2xl bg-gradient-to-br from-blue-500 to-primary opacity-0 shadow-lg [animation:collage-in-left_0.7s_ease-out_forwards]"
        style={{ animationDelay: "140ms" }}
        aria-hidden
      />

      <div
        className="ml-auto grid w-[72%]"
        style={{ gridTemplateColumns: "44% 56%", gridTemplateAreas: '"a b" "c b" "d d"' }}
      >
        <div
          className="relative aspect-[4/3] overflow-hidden rounded-tl-2xl opacity-0 shadow-xl [animation:collage-in-right_0.7s_ease-out_forwards]"
          style={{ gridArea: "a", animationDelay: "280ms" }}
        >
          <Image
            src="/marketing/landing-collage-stethoscope-meds.jpg"
            alt={altTexts[0]}
            fill
            className="object-cover"
          />
        </div>

        <div
          className="relative overflow-hidden rounded-tr-2xl opacity-0 shadow-xl [animation:collage-in-right_0.7s_ease-out_forwards]"
          style={{ gridArea: "b", animationDelay: "420ms" }}
        >
          <Image
            src="/marketing/landing-collage-blood-sample.jpg"
            alt={altTexts[1]}
            fill
            className="object-cover"
            priority
          />
        </div>

        <div
          className="relative aspect-[4/3] overflow-hidden rounded-bl-2xl opacity-0 shadow-xl [animation:collage-in-left_0.7s_ease-out_forwards]"
          style={{ gridArea: "c", animationDelay: "560ms" }}
        >
          <Image
            src="/marketing/landing-collage-stethoscope-icons.jpg"
            alt={altTexts[2]}
            fill
            className="object-cover"
          />
        </div>

        <div
          className="relative aspect-[21/7] overflow-hidden rounded-b-2xl opacity-0 shadow-xl [animation:collage-in-right_0.7s_ease-out_forwards]"
          style={{ gridArea: "d", animationDelay: "700ms" }}
        >
          <Image src="/marketing/landing-collage-reports.jpg" alt={altTexts[3]} fill className="object-cover" />
        </div>
      </div>
    </div>
  );
}
