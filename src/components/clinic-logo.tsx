import { cn } from "@/lib/utils";

export function ClinicLogo({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-[#1a1a1a]", className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/nca_clinic_logo.png"
        alt=""
        className="absolute inset-[6%] object-contain"
        style={{ width: "88%", height: "88%" }}
      />
    </div>
  );
}
