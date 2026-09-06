"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { addInvoiceItem, type InvoiceItemFormState } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AddInvoiceItemForm({
  invoiceId,
  packages,
  services,
}: {
  invoiceId: string;
  packages?: { id: string; name: string; price: number }[];
  services?: { id: string; name: string; price: number }[];
}) {
  const t = useTranslations("billing");
  const boundAction = addInvoiceItem.bind(null, invoiceId);
  const [state, formAction, pending] = useActionState<InvoiceItemFormState, FormData>(
    boundAction,
    {}
  );
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [clinicServiceId, setClinicServiceId] = useState("");

  function handlePackage(packageId: string) {
    const pkg = packages?.find((p) => p.id === packageId);
    if (!pkg) return;
    setDescription(pkg.name);
    setUnitPrice(String(pkg.price));
    setClinicServiceId("");
  }

  function handleService(serviceId: string) {
    const service = services?.find((s) => s.id === serviceId);
    if (!service) return;
    setDescription(service.name);
    setUnitPrice(String(service.price));
    setClinicServiceId(serviceId);
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      {services && services.length > 0 && (
        <Select onValueChange={handleService}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Add service" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name} — {service.price.toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {packages && packages.length > 0 && (
        <Select onValueChange={handlePackage}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder={t("addPackage")} />
          </SelectTrigger>
          <SelectContent>
            {packages.map((pkg) => (
              <SelectItem key={pkg.id} value={pkg.id}>
                {pkg.name} — {pkg.price.toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <input type="hidden" name="clinicServiceId" value={clinicServiceId} />
      <Input
        name="description"
        placeholder="Description"
        className="w-40"
        required
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          setClinicServiceId("");
        }}
      />
      <Input
        name="quantity"
        type="number"
        min={1}
        defaultValue={1}
        className="w-20"
        placeholder="Qty"
        required
      />
      <Input
        name="unitPrice"
        type="number"
        min={0}
        step="0.01"
        className="w-28"
        placeholder="Unit price"
        required
        value={unitPrice}
        onChange={(e) => setUnitPrice(e.target.value)}
      />
      <Button type="submit" size="sm" disabled={pending}>
        Add item
      </Button>
      {state.error && <span className="text-sm text-destructive">{state.error}</span>}
    </form>
  );
}
