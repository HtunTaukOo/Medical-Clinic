import type { ReactNode } from "react";

export function SolidStatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  className: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl p-5 text-white ${className}`}>
      <div>
        <p className="text-xs font-semibold tracking-wide text-white/80 uppercase">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {sublabel && <p className="mt-1 text-xs text-white/70">{sublabel}</p>}
      </div>
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/20">
        <Icon className="size-5" />
      </div>
    </div>
  );
}
