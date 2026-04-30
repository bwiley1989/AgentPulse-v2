import React, { useState } from "react";
import {
  Dropdown,
  Option,
  Button,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import type { Tenant } from "../api";
import ConnectTenantDialog from "./ConnectTenantDialog";
import { colors } from "../theme";

interface Props {
  tenants: Tenant[];
  selected: string;
  onChange: (id: string) => void;
  onTenantsChanged?: () => void;
}

export default function TenantSelector({ tenants, selected, onChange, onTenantsChanged }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Dropdown
        placeholder="Select tenant"
        value={tenants.find((t) => t.id === selected)?.name || ""}
        selectedOptions={[selected]}
        onOptionSelect={(_, d) => onChange(d.optionValue as string)}
        style={{ minWidth: "260px" }}
      >
        {tenants.map((t) => (
          <Option key={t.id} value={t.id} text={t.name}>
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: t.source === "live" || t.connected || t.real ? colors.green : "#A19F9D",
                  flexShrink: 0,
                }}
              />
              <span>{t.name}</span>
              {t.seats ? (
                <span style={{ color: colors.gray, fontSize: "12px" }}>
                  ({t.seats.toLocaleString()} seats)
                </span>
              ) : t.real ? (
                <span style={{ color: colors.green, fontSize: "12px" }}>Connected</span>
              ) : null}
            </span>
          </Option>
        ))}
      </Dropdown>
      <Button
        appearance="subtle"
        icon={<Add20Regular />}
        onClick={() => setDialogOpen(true)}
        title="Connect a new tenant"
        size="small"
      >
        Connect Tenant
      </Button>
      <ConnectTenantDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConnected={() => {
          setDialogOpen(false);
          onTenantsChanged?.();
        }}
      />
    </div>
  );
}
