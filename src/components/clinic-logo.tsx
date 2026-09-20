import { cn } from "@/lib/utils";

// Falls back to the built-in static logo until an admin uploads a real one
// (Settings > Clinic Profile) — pass hasLogo from wherever ClinicSettings
// was already fetched (see AppShell, the login page, and the portal
// dashboard) rather than querying it again here.
//
// White badge background rather than dark: the built-in logo is exported
// with a transparent background so it read fine on the old dark badge, but
// an admin-uploaded logo is very unlikely to be pre-transparent — most
// exported/screenshotted logos carry their own opaque (often white)
// background, which looked like a mismatched box against a dark badge. A
// white badge with a hairline ring looks right for both, and for this
// component's actual placements (dark sidebar, dark login panel, colorful
// portal banner).
export function ClinicLogo({ className, hasLogo }: { className?: string; hasLogo?: boolean }) {
  return (
    <div
      className={cn("relative overflow-hidden bg-white ring-1 ring-black/10", className)}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hasLogo ? "/api/clinic-settings/logo" : "/nca_clinic_logo.png"}
        alt=""
        className="absolute inset-[6%] object-contain"
        style={{ width: "88%", height: "88%" }}
      />
    </div>
  );
}
