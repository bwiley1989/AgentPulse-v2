import React from "react";
import { Card, Text, makeStyles, Link } from "@fluentui/react-components";
import { ArrowTrendingLines20Regular } from "@fluentui/react-icons";
import { colors } from "../../theme";

const useStyles = makeStyles({
  card: {
    padding: "20px 24px",
    backgroundColor: colors.card,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    borderRadius: "8px",
    flex: "1 1 0",
    minWidth: "240px",
  },
  label: { fontSize: "13px", color: colors.gray, marginBottom: "4px" },
  valueRow: { display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "4px" },
  value: { fontSize: "36px", fontWeight: 700, color: "#201F1E" },
  unit: { fontSize: "14px", color: colors.gray },
  trend: { display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 600 },
});

interface Props {
  label: string;
  value: number | string;
  unit?: string;
  trend: number;
  direction: "up" | "down";
  onViewDetails?: () => void;
}

export default function KPICard({ label, value, unit, trend, direction, onViewDetails }: Props) {
  const styles = useStyles();
  const trendColor = direction === "up" ? colors.green : colors.red;
  const arrow = direction === "up" ? "▲" : "▼";

  return (
    <Card className={styles.card}>
      <Text className={styles.label}>{label}</Text>
      <div className={styles.valueRow}>
        <Text className={styles.value}>{typeof value === "number" ? value.toLocaleString() : value}</Text>
        <Text className={styles.unit}>{unit}</Text>
      </div>
      <div className={styles.trend} style={{ color: trendColor }}>
        <span>{arrow}</span>
        <span>{Math.abs(trend)}%</span>
        <ArrowTrendingLines20Regular />
      </div>
      <Link
        style={{ fontSize: "13px", marginTop: "8px", display: "inline-block", cursor: "pointer" }}
        onClick={(e) => {
          e.preventDefault();
          onViewDetails?.();
        }}
      >
        View details →
      </Link>
    </Card>
  );
}
