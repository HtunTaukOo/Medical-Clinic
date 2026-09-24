import Image from "next/image";

// The four real reference photos, arranged as an asymmetric collage next to
// two decorative CSS shapes. Left-column tiles slide in from the left,
// right-column tiles slide in from the right (see @keyframes collage-in-left
// / collage-in-right in globals.css), each with an increasing delay so the
// pieces appear to move into place side by side, one after another, instead
// of all appearing at once.
export function HeroPhotoCollage({
  altTexts,
}: {
  altTexts: [string, string, string, string];
}) {
  return (
    <div className="relative mx-auto aspect-[6/5] w-full max-w-lg">
      <div
        className="absolute top-0 left-0 size-14 rounded-full bg-gradient-to-br from-teal-300 to-teal-500 opacity-0 shadow-lg [animation:collage-in-left_0.7s_ease-out_forwards]"
        style={{ animationDelay: "0ms" }}
        aria-hidden
      />
      <div
        className="absolute top-12 left-2 h-20 w-28 rounded-2xl bg-gradient-to-br from-blue-500 to-primary opacity-0 shadow-lg [animation:collage-in-left_0.7s_ease-out_forwards]"
        style={{ animationDelay: "140ms" }}
        aria-hidden
      />

      <div
        className="absolute top-0 left-[34%] h-[34%] w-[28%] overflow-hidden rounded-2xl opacity-0 shadow-xl [animation:collage-in-right_0.7s_ease-out_forwards]"
        style={{ animationDelay: "280ms" }}
      >
        <Image src="/marketing/landing-collage-stethoscope-meds.jpg" alt={altTexts[0]} fill className="object-cover" />
      </div>

      <div
        className="absolute top-0 right-0 h-[62%] w-[38%] overflow-hidden rounded-2xl opacity-0 shadow-xl [animation:collage-in-right_0.7s_ease-out_forwards]"
        style={{ animationDelay: "420ms" }}
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
        className="absolute bottom-0 left-0 h-[42%] w-[34%] overflow-hidden rounded-2xl opacity-0 shadow-xl [animation:collage-in-left_0.7s_ease-out_forwards]"
        style={{ animationDelay: "560ms" }}
      >
        <Image
          src="/marketing/landing-collage-stethoscope-icons.jpg"
          alt={altTexts[2]}
          fill
          className="object-cover"
        />
      </div>

      <div
        className="absolute right-[2%] bottom-0 h-[38%] w-[32%] overflow-hidden rounded-2xl opacity-0 shadow-xl [animation:collage-in-right_0.7s_ease-out_forwards]"
        style={{ animationDelay: "700ms" }}
      >
        <Image src="/marketing/landing-collage-reports.jpg" alt={altTexts[3]} fill className="object-cover" />
      </div>
    </div>
  );
}
