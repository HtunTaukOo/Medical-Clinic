import { cn } from "@/lib/utils";

// Falls back to the built-in static logo until an admin uploads a real one
// (Settings > Clinic Profile) — pass hasLogo from wherever ClinicSettings
// was already fetched (see AppShell, the login page, and the portal
// dashboard) rather than querying it again here.
export function ClinicLogo({ className, hasLogo }: { className?: string; hasLogo?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-[#1a1a1a]", className)} aria-hidden="true">
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
