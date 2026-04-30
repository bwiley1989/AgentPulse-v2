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
  scoreCircle: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: 700,
    color: "#FFFFFF",
    margin: "12px auto",
  },
  item: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.grayLight}` },
});

interface Props { tenantId: string; }

export default function Security({ tenantId }: Props) {
  const styles = useStyles();
  const [data, setData] = useState<any>(null);

  useEffect(() => { if (tenantId) api.security(tenantId).then(setData); }, [tenantId]);
  if (!data) return <Spinner label="Loading security..." />;

  const scoreColor = data.overallScore >= 80 ? colors.green : data.overallScore >= 60 ? colors.orange : colors.red;

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <Text className={styles.heading}>Security Posture</Text>
        <DataSourceBadge source={data.source} />
      </div>
      <div className={styles.row}>
        <Card className={styles.card}>
          <Text style={{ fontWeight: 600, display: "block" }}>Overall Score</Text>
          <div className={styles.scoreCircle} style={{ backgroundColor: scoreColor }}>{data.overallScore}</div>
          <Text style={{ textAlign: "center", display: "block", color: colors.gray }}>out of 100</Text>
        </Card>
        <Card className={styles.card}>
          <Text style={{ fontWeight: 600, display: "block", marginBottom: "12px" }}>DLP Summary</Text>
          <div className={styles.item}><span>Active Policies</span><strong>{data.dlpPolicies}</strong></div>
          <div className={styles.item}><span>Violations (30d)</span><strong>{data.dlpViolations30d}</strong></div>
          <div className={styles.item}><span>Sensitivity Labels</span><strong>{data.sensitivityLabels}</strong></div>
        </Card>
        <Card className={styles.card}>
          <Text style={{ fontWeight: 600, display: "block", marginBottom: "12px" }}>Compliance Checks</Text>
          {data.complianceChecks.map((c: any, i: number) => (
            <div key={i} className={styles.item}>
              <span>{c.name}</span>
              <Badge appearance="filled" color={c.passed ? "success" : "danger"}>{c.passed ? "Pass" : "Fail"}</Badge>
            </div>
          ))}
        </Card>
      </div>
      <Card className={styles.card} style={{ flex: "1 1 100%" }}>
        <Text style={{ fontWeight: 600, display: "block", marginBottom: "12px" }}>Risk Alerts</Text>
        {data.riskAlerts.map((a: any, i: number) => (
          <div key={i} className={styles.item}>
            <Badge appearance="filled" color={a.level === "high" ? "danger" : "warning"} style={{ marginRight: "8px" }}>{a.level}</Badge>
            <span style={{ flex: 1 }}>{a.message}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
