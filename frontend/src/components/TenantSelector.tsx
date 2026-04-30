import React from "react";
import { Dropdown, Option } from "@fluentui/react-components";
import type { Tenant } from "../api";

interface Props {
  tenants: Tenant[];
  selected: string;
  onChange: (id: string) => void;
}

export default function TenantSelector({ tenants, selected, onChange }: Props) {
  return (
    <Dropdown
      placeholder="Select tenant"
      value={tenants.find((t) => t.id === selected)?.name || ""}
      selectedOptions={[selected]}
      onOptionSelect={(_, d) => onChange(d.optionValue as string)}
      style={{ minWidth: "220px" }}
    >
      {tenants.map((t) => (
        <Option key={t.id} value={t.id} text={`${t.name} (${t.seats.toLocaleString()} seats)`}>
          {t.name} ({t.seats.toLocaleString()} seats)
        </Option>
      ))}
    </Dropdown>
  );
}
