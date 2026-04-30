import React, { useEffect, useState } from "react";
import { makeStyles, Spinner, Text, Card } from "@fluentui/react-components";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import ChartPanel from "../components/Dashboard/ChartPanel";
import DataSourceBadge from "../components/DataSourceBadge";
import { api } from "../api";
import { colors } from "../theme";

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
  stat: { fontSize: "32px", fontWeight: 700, color: colors.blue, display: "block", marginTop: "8px" },
  statLabel: { fontSize: "13px", color: colors.gray },
});

interface Props { tenantId: string; }

export default function Usage({ tenantId }: Props) {
  const styles = useStyles();
  const [data, setData] = useState<any>(null);

  useEffect(() => { if (tenantId) api.usage(tenantId).then(setData); }, [tenantId]);
  if (!data) return <Spinner label="Loading usage..." />;

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <Text className={styles.heading}>Usage Analytics</Text>
        <DataSourceBadge source={data.source} />
      </div>
      <div className={styles.row}>
        <Card className={styles.card}>
          <Text className={styles.statLabel}>Total Queries (30d)</Text>
          <Text className={styles.stat}>{data.totalQueries30d.toLocaleString()}</Text>
        </Card>
        <Card className={styles.card}>
          <Text className={styles.statLabel}>Avg Queries / User</Text>
          <Text className={styles.stat}>{data.avgQueriesPerUser}</Text>
        </Card>
      </div>
      <div className={styles.row}>
        <ChartPanel title="Usage Trend" data={data.usageTrend} type="line" color={colors.blue} />
        <Card className={styles.card} style={{ flex: "1 1 45%", minWidth: "340px" }}>
          <Text style={{ fontWeight: 600, marginBottom: "12px", display: "block" }}>Top Features</Text>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.topFeatures} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grayLight} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Bar dataKey="usage" fill={colors.blue} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
