import React, { useEffect, useState } from "react";
import { makeStyles, Spinner, Text, Card, Badge } from "@fluentui/react-components";
import { api } from "../api";
import { colors } from "../theme";
import DataSourceBadge from "../components/DataSourceBadge";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  row: { display: "flex", gap: "16px", flexWrap: "wrap" },
  card: {
    padding: "20px",
    backgroundColor: colors.card,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    borderRadius: "8px",
    flex: "1 1 280px",
    minWidth: "280px",
  },
  headingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: { fontSize: "24px", fontWeight: 700, color: "#201F1E" },
  stat: { fontSize: "32px", fontWeight: 700, display: "block", marginTop: "8px" },
  statLabel: { fontSize: "13px", color: colors.gray },
  item: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${colors.grayLight}` },
});

interface Props { tenantId: string; }

export default function Health({ tenantId }: Props) {
  const styles = useStyles();
  const [data, setData] = useState<any>(null);

  useEffect(() => { if (tenantId) api.health(tenantId).then(setData); }, [tenantId]);
  if (!data) return <Spinner label="Loading health..." />;

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <Text className={styles.heading}>Service Health</Text>
        <DataSourceBadge source={data.source} />
      </div>
      <div className={styles.row}>
        <Card className={styles.card}>
          <Text className={styles.statLabel}>Overall Status</Text>
          <Badge
            appearance="filled"
            color={data.overallStatus === "healthy" ? "success" : "warning"}
            style={{ fontSize: "18px", padding: "8px 16px", marginTop: "8px" }}
          >
            {data.overallStatus.toUpperCase()}
          </Badge>
        </Card>
        <Card className={styles.card}>
          <Text className={styles.statLabel}>Latency P50</Text>
          <Text className={styles.stat} style={{ color: colors.blue }}>{data.latencyP50Ms}ms</Text>
        </Card>
        <Card className={styles.card}>
          <Text className={styles.statLabel}>Latency P99</Text>
          <Text className={styles.stat} style={{ color: colors.orange }}>{data.latencyP99Ms}ms</Text>
        </Card>
        <Card className={styles.card}>
          <Text className={styles.statLabel}>Error Rate</Text>
          <Text className={styles.stat} style={{ color: data.errorRate > 1 ? colors.red : colors.green }}>{data.errorRate}%</Text>
        </Card>
      </div>
      <Card className={styles.card} style={{ flex: "1 1 100%" }}>
        <Text style={{ fontWeight: 600, display: "block", marginBottom: "12px" }}>Services</Text>
        {data.services.map((s: any, i: number) => (
          <div key={i} className={styles.item}>
            <span style={{ fontWeight: 500 }}>{s.name}</span>
            <span style={{ color: colors.gray }}>Uptime: {s.uptime}%</span>
            <Badge appearance="filled" color={s.status === "healthy" ? "success" : "warning"}>{s.status}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}
