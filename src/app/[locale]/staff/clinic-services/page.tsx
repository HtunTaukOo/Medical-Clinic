import { Building2, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/authz";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ClinicServiceEditDialog } from "@/components/staff/clinic-service-edit-dialog";

function formatKyat(value: number) {
  return `K ${Math.round(value).toLocaleString()}`;
}

const SPECIALTY_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-pink-100 text-pink-700",
];

function specialtyColorClass(specialty: string | null) {
  if (!specialty) return "bg-slate-100 text-slate-700";
  let hash = 0;
  for (let i = 0; i < specialty.length; i++) hash = (hash * 31 + specialty.charCodeAt(i)) >>> 0;
  return SPECIALTY_COLORS[hash % SPECIALTY_COLORS.length];
}

export default async function ClinicServicesPage() {
  await requirePageRole(["ADMIN"]);

  const services = await prisma.clinicService.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clinic Services</h1>
          <p className="text-sm text-muted-foreground">Manage all clinic services and pricing.</p>
        </div>
        <Button asChild>
          <Link href="/staff/clinic-services/new">
            <Plus className="size-4" />
            Add Service
          </Link>
        </Button>
      </div>

      {services.length === 0 ? (
        <EmptyState icon={Building2} message="No clinic services yet." />
      ) : (
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Name</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>
                      {service.specialty ? (
                        <Badge variant="outline" className={specialtyColorClass(service.specialty)}>
                          {service.specialty}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {service.durationMinutes} min
                    </TableCell>
                    <TableCell>{formatKyat(Number(service.price))}</TableCell>
                    <TableCell className="text-muted-foreground">{service.room ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          service.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }
                      >
                        {service.active ? "Available" : "Unavailable"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ClinicServiceEditDialog
                        service={{
                          id: service.id,
                          name: service.name,
                          specialty: service.specialty,
                          durationMinutes: service.durationMinutes,
                          price: Number(service.price),
                          room: service.room,
                          active: service.active,
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
