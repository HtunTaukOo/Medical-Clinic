import { Stethoscope, FlaskConical, HeartPulse, Smile, MessageCircle, Wifi } from "lucide-react";
import { ClinicLogo } from "@/components/clinic-logo";

const RING_SIZE_REM = 22;
const RADIUS_REM = 10; // icon badges sit just inside the outer ring line
const SPIN_DURATION = "26s";

// Badge/icon sizes are deliberately uneven (not one uniform size) — bigger
// and smaller badges orbiting together reads as far livelier than a row of
// identical circles sweeping around in lockstep.
const ORBIT_ITEMS = [
  { key: "stethoscope", Icon: Stethoscope, badgeSize: "size-16", iconSize: "size-7", className: "bg-emerald-500 text-white" },
  { key: "message", Icon: MessageCircle, badgeSize: "size-9", iconSize: "size-4", className: "bg-white text-primary ring-1 ring-primary/15" },
  { key: "heart", Icon: HeartPulse, badgeSize: "size-14", iconSize: "size-6", className: "bg-orange-500 text-white" },
  { key: "smile", Icon: Smile, badgeSize: "size-10", iconSize: "size-5", className: "bg-amber-400 text-white" },
  { key: "flask", Icon: FlaskConical, badgeSize: "size-14", iconSize: "size-6", className: "bg-blue-500 text-white" },
  { key: "wifi", Icon: Wifi, badgeSize: "size-11", iconSize: "size-5", className: "bg-emerald-400 text-white" },
] as const;

// Center logo stays static; a ring of icon badges orbits continuously around
// it (outer layer spins via CSS, see @keyframes orbit-spin in globals.css).
// Each badge's own inner circle spins the opposite direction at the same
// speed, cancelling the parent's rotation so the icon glyph itself stays
// upright throughout — the classic "counter-rotating children" technique,
// pure CSS, no animation library or client component needed.
export function OrbitIconRing({ hasLogo }: { hasLogo: boolean }) {
  return (
    <div className="relative mx-auto" style={{ width: `${RING_SIZE_REM}rem`, height: `${RING_SIZE_REM}rem` }}>
      <div className="absolute inset-0 rounded-full border border-primary/20" />
      <div className="absolute inset-10 rounded-full border border-primary/10" />

      <div className="absolute inset-0 grid place-items-center">
        <div className="grid size-36 place-items-center rounded-full bg-gradient-to-br from-violet-100 via-primary/10 to-primary/15 shadow-inner ring-1 ring-primary/10">
          <ClinicLogo hasLogo={hasLogo} className="size-32 rounded-full" />
        </div>
      </div>

      <div className="absolute inset-0 [animation:orbit-spin_26s_linear_infinite]">
        {ORBIT_ITEMS.map((item, i) => {
          const angle = (360 / ORBIT_ITEMS.length) * i;
          return (
            <div
              key={item.key}
              className="absolute top-1/2 left-1/2 grid size-16 place-items-center"
              style={{
                transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${RADIUS_REM}rem) rotate(${-angle}deg)`,
              }}
            >
              <div
                className={`flex ${item.badgeSize} items-center justify-center rounded-full shadow-lg ${item.className}`}
                style={{ animation: `orbit-spin-reverse ${SPIN_DURATION} linear infinite` }}
              >
                <item.Icon className={item.iconSize} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
