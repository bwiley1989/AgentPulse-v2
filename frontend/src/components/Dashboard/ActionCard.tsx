import React from "react";
import { Card, Text, Badge, Button, makeStyles } from "@fluentui/react-components";
import { colors } from "../../theme";

const useStyles = makeStyles({
  card: {
    padding: "16px 20px",
    backgroundColor: colors.card,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    borderRadius: "8px",
    flex: "1 1 0",
    minWidth: "200px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: "14px", fontWeight: 600, color: "#323130" },
});

interface Props {
  title: string;
  count: number;
  severity: "info" | "warning" | "critical";
  cta: string;
  onAction?: () => void;
}

const badgeColor: Record<string, "informative" | "warning" | "danger"> = {
  info: "informative",
  warning: "warning",
  critical: "danger",
};

// Map CTA text to navigation targets
const ctaToRoute: Record<string, string> = {
  "Assign now": "/agents",
  "Review": "/security",
  "Investigate": "/health",
  "View all": "/usage",
};

export default function ActionCard({ title, count, severity, cta, onAction }: Props) {
  const styles = useStyles();
  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Text className={styles.title}>{title}</Text>
        <Badge appearance="filled" color={badgeColor[severity] || "informative"}>
          {count}
        </Badge>
      </div>
      <Button
        appearance="outline"
        size="small"
        onClick={() => onAction?.()}
      >
        {cta}
      </Button>
    </Card>
  );
}

export { ctaToRoute };
