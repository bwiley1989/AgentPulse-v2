import React, { useEffect, useState } from "react";
import { makeStyles, Spinner, Text } from "@fluentui/react-components";
import KPICard from "../components/Dashboard/KPICard";
import ActionCard from "../components/Dashboard/ActionCard";
import ChartPanel from "../components/Dashboard/ChartPanel";
import { api } from "../api";
import { colors } from "../theme";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  row: { display: "flex", gap: "16px", flexWrap: "wrap" },
  heading: { fontSize: "24px", fontWeight: 700, color: "#201F1E" },
});

interface Props {
  tenantId: string;
}

export default function Overview({ tenantId }: Props) {
  const styles = useStyles();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (tenantId) api.overview(tenantId).then(setData);
  }, [tenantId]);

  if (!data) return <Spinner label="Loading overview..." />;

  return (
    <div className={styles.page}>
      <Text className={styles.heading}>Copilot Overview</Text>

      <div className={styles.row}>
        {data.kpis.map((k: any, i: number) => (
          <KPICard key={i} label={k.label} value={k.value} unit={k.unit} trend={k.trend} direction={k.direction} />
        ))}
      </div>

      <Text style={{ fontSize: "16px", fontWeight: 600, color: "#323130" }}>Needs attention</Text>
      <div className={styles.row}>
        {data.actions.map((a: any, i: number) => (
          <ActionCard key={i} title={a.title} count={a.count} severity={a.severity} cta={a.cta} />
        ))}
      </div>

      <Text style={{ fontSize: "16px", fontWeight: 600, color: "#323130" }}>Trends</Text>
      <div className={styles.row}>
        <ChartPanel title="Daily Active Users" data={data.charts.dailyActiveUsers} />
        <ChartPanel title="Adoption Score" data={data.charts.adoptionOverTime} color={colors.green} />
        <ChartPanel title="Queries per Day" data={data.charts.queriesPerDay} type="bar" />
        <ChartPanel title="User Satisfaction" data={data.charts.satisfactionTrend} color={colors.orange} />
      </div>
    </div>
  );
}
