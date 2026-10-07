import {
  Activity,
  CalendarDays,
  ClipboardPlus,
  HeartPulse,
  MessageCircle,
  Smile,
  Stethoscope,
  Wifi,
} from "lucide-react";
import { ClinicLogo } from "@/components/clinic-logo";

const OUTER_SPIN_DURATION = "26s";
const INNER_SPIN_DURATION = "19s";

// Badge/icon sizes are deliberately uneven (not one uniform size) — bigger
// and smaller badges orbiting together reads as far livelier than a row of
// identical circles sweeping around in lockstep.
const ORBIT_ITEMS = [
  { key: "stethoscope", Icon: Stethoscope, orbit: "outer", badgeSize: "size-16", iconSize: "size-7", className: "bg-emerald-500 text-white" },
  { key: "heart", Icon: HeartPulse, orbit: "outer", badgeSize: "size-14", iconSize: "size-6", className: "bg-orange-500 text-white" },
  { key: "calendar", Icon: CalendarDays, orbit: "outer", badgeSize: "size-12", iconSize: "size-5", className: "bg-primary text-white" },
  { key: "activity", Icon: Activity, orbit: "outer", badgeSize: "size-8", iconSize: "size-4", className: "bg-cyan-500 text-white" },
  { key: "message", Icon: MessageCircle, orbit: "inner", badgeSize: "size-9", iconSize: "size-4", className: "bg-white text-primary ring-1 ring-primary/15" },
  { key: "smile", Icon: Smile, orbit: "inner", badgeSize: "size-11", iconSize: "size-5", className: "bg-amber-400 text-white" },
  { key: "wifi", Icon: Wifi, orbit: "inner", badgeSize: "size-13", iconSize: "size-6", className: "bg-emerald-400 text-white" },
  { key: "clipboard", Icon: ClipboardPlus, orbit: "inner", badgeSize: "size-16", iconSize: "size-7", className: "bg-violet-500 text-white" },
] as const;

// Center logo stays static; a ring of icon badges orbits continuously around
// it (outer layer spins via CSS, see @keyframes orbit-spin in globals.css).
// Each badge's own inner circle spins the opposite direction at the same
// speed, cancelling the parent's rotation so the icon glyph itself stays
// upright throughout — the classic "counter-rotating children" technique,
// pure CSS, no animation library or client component needed.
export function OrbitIconRing({ hasLogo }: { hasLogo: boolean }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[32rem]">
      <div className="absolute inset-0 rounded-full border border-primary/20" />
      <div className="absolute inset-[18.75%] rounded-full border border-primary/10" />

      <div className="absolute inset-0 grid place-items-center">
        <div className="grid size-44 place-items-center rounded-full bg-gradient-to-br from-violet-100 via-primary/10 to-primary/15 shadow-inner ring-1 ring-primary/10">
          <ClinicLogo hasLogo={hasLogo} className="size-40 rounded-full" />
        </div>
      </div>

      {(["outer", "inner"] as const).map((orbit) => {
        const orbitItems = ORBIT_ITEMS.filter((item) => item.orbit === orbit);
        const isOuter = orbit === "outer";
        const radius = isOuter
          ? "clamp(11.2rem, 50vw, 16rem)"
          : "clamp(6.8rem, 31vw, 10rem)";
        const spinDuration = isOuter ? OUTER_SPIN_DURATION : INNER_SPIN_DURATION;
        const ringAnimation = isOuter ? "orbit-spin" : "orbit-spin-reverse";
        const badgeAnimation = isOuter ? "orbit-spin-reverse" : "orbit-spin";

        return (
          <div
            key={orbit}
            className="absolute inset-0"
            style={{ animation: `${ringAnimation} ${spinDuration} linear infinite` }}
          >
            {orbitItems.map((item, i) => {
              const angle = (360 / orbitItems.length) * i;
          return (
            <div
              key={item.key}
              className="absolute top-1/2 left-1/2 grid size-16 place-items-center"
              style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${radius}) rotate(${-angle}deg)`,
              }}
            >
              <div
                className={`flex ${item.badgeSize} items-center justify-center rounded-full shadow-lg ${item.className}`}
                style={{ animation: `${badgeAnimation} ${spinDuration} linear infinite` }}
              >
                <item.Icon className={item.iconSize} />
              </div>
            </div>
          );
            })}
          </div>
        );
      })}
    </div>
  );
}
