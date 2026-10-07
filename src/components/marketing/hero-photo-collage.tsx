import Image from "next/image";

// Three-photo hero composition: a tall feature image on the right, two
// rounded supporting images on the left, and mint/blue accent shapes.
export function HeroPhotoCollage({
  altTexts,
}: {
  altTexts: [string, string, string];
}) {
  return (
    <div className="relative mx-auto aspect-[6/5] w-full max-w-lg">
      <div
        className="absolute top-[26%] left-[13%] z-10 size-14 rounded-full bg-gradient-to-br from-teal-300 to-teal-500 opacity-0 shadow-lg [animation:collage-in-left_0.7s_ease-out_forwards]"
        style={{ animationDelay: "0ms" }}
        aria-hidden
      />
      <div
        className="absolute bottom-[40%] left-0 z-10 h-[18%] w-[24%] rounded-tl-[3rem] rounded-br-[3rem] bg-gradient-to-br from-blue-500 to-primary opacity-0 shadow-lg [animation:collage-in-left_0.7s_ease-out_forwards]"
        style={{ animationDelay: "140ms" }}
        aria-hidden
      />

      <div
        className="absolute top-0 right-0 h-[92%] w-[46%] overflow-hidden rounded-tl-[4rem] rounded-br-[4rem] opacity-0 shadow-xl [animation:collage-in-right_0.7s_ease-out_forwards]"
        style={{ animationDelay: "280ms" }}
      >
        <Image src="/marketing/landing-collage-blood-sample.jpg" alt={altTexts[1]} fill className="object-cover" priority />
      </div>
      <div
        className="absolute top-[15%] left-[27%] h-[45%] w-[24%] overflow-hidden rounded-tl-[3rem] rounded-br-[3rem] opacity-0 shadow-xl [animation:collage-in-left_0.7s_ease-out_forwards]"
        style={{ animationDelay: "420ms" }}
      >
        <Image src="/marketing/landing-collage-stethoscope-meds.jpg" alt={altTexts[0]} fill className="object-cover" />
      </div>
      <div
        className="absolute bottom-[8%] left-0 h-[29%] w-[52%] overflow-hidden rounded-tl-[3rem] rounded-br-[3rem] opacity-0 shadow-xl [animation:collage-in-left_0.7s_ease-out_forwards]"
        style={{ animationDelay: "560ms" }}
      >
        <Image src="/marketing/landing-collage-stethoscope-icons.jpg" alt={altTexts[2]} fill className="object-cover" />
      </div>
    </div>
  );
}
