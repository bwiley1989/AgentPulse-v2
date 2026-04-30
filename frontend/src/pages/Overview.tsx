import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { makeStyles, Spinner, Text } from "@fluentui/react-components";
import KPICard from "../components/Dashboard/KPICard";
import ActionCard, { ctaToRoute } from "../components/Dashboard/ActionCard";
import ChartPanel from "../components/Dashboard/ChartPanel";
import DataSourceBadge from "../components/DataSourceBadge";
import { api, Period } from "../api";
import { colors } from "../theme";

const useStyles = makeStyles({
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  row: { display: "flex", gap: "16px", flexWrap: "wrap" },
  headingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: { fontSize: "24px", fontWeight: 700, color: "#201F1E" },
});

interface Props {
  tenantId: string;
}

export default function Overview({ tenantId }: Props) {
  const styles = useStyles();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const trendsRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<Period>("D7");

  useEffect(() => {
    if (tenantId) {
      setData(null);
      api.overview(tenantId, period).then(setData);
    }
  }, [tenantId, period]);

  if (!data) return <Spinner label="Loading overview..." />;

  const handleViewDetails = (kpiLabel: string) => {
    // Scroll to trends section
    trendsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleAction = (cta: string) => {
    const route = ctaToRoute[cta];
    if (route) {
      navigate(route);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <Text className={styles.heading}>Copilot Overview</Text>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", gap: "4px", background: "#F3F2F1", borderRadius: "6px", padding: "2px" }}>
            {(["D7", "D30", "D90"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: "4px 12px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: period === p ? 600 : 400,
                  background: period === p ? "#fff" : "transparent",
                  boxShadow: period === p ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  color: period === p ? colors.blue : colors.gray,
                }}
              >
                {p === "D7" ? "7 days" : p === "D30" ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
          <DataSourceBadge source={data.dataSource || data.source} />
        </div>
      </div>

      <div className={styles.row}>
        {data.kpis.map((k: any, i: number) => (
          <KPICard
            key={i}
            label={k.label}
            value={k.value}
            unit={k.unit}
            trend={k.trend}
            direction={k.direction}
            onViewDetails={() => handleViewDetails(k.label)}
          />
        ))}
      </div>

      <Text style={{ fontSize: "16px", fontWeight: 600, color: "#323130" }}>Needs attention</Text>
      <div className={styles.row}>
        {(data.actions || []).map((a: any, i: number) => (
          <ActionCard
            key={i}
            title={a.title}
            count={a.count}
            severity={a.severity}
            cta={a.cta}
            onAction={() => handleAction(a.cta)}
          />
        ))}
      </div>

      <div ref={trendsRef}>
        <Text style={{ fontSize: "16px", fontWeight: 600, color: "#323130", display: "block", marginBottom: "8px" }}>
          Trends
        </Text>
      </div>
      <div className={styles.row}>
        <ChartPanel title="Daily Active Users" data={data.charts?.dailyActiveUsers || []} />
        <ChartPanel title="Adoption Score" data={data.charts?.adoptionOverTime || []} color={colors.green} />
        <ChartPanel title="Queries per Day" data={data.charts?.queriesPerDay || []} type="bar" />
        <ChartPanel title="User Satisfaction" data={data.charts?.satisfactionTrend || []} color={colors.orange} />
      </div>
    </div>
  );
}
