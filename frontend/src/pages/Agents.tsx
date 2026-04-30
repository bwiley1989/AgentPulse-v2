import React, { useEffect, useState } from "react";
import {
  makeStyles,
  Spinner,
  Text,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
  Card,
} from "@fluentui/react-components";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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
    flex: "1 1 45%",
    minWidth: "340px",
  },
  heading: { fontSize: "24px", fontWeight: 700, color: "#201F1E" },
});

interface Props {
  tenantId: string;
}

export default function Agents({ tenantId }: Props) {
  const styles = useStyles();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (tenantId) api.agents(tenantId).then(setData);
  }, [tenantId]);

  if (!data) return <Spinner label="Loading agents..." />;

  const platformData = Object.entries(data.platformBreakdown).map(([name, count]) => ({ name, count }));

  return (
    <div className={styles.page}>
      <Text className={styles.heading}>Agent Registry</Text>

      <div className={styles.row}>
        <Card className={styles.card}>
          <Text style={{ fontWeight: 600, marginBottom: "12px", display: "block" }}>Trending Agents (7d invocations)</Text>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.trending}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grayLight} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="invocations7d" fill={colors.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className={styles.card}>
          <Text style={{ fontWeight: 600, marginBottom: "12px", display: "block" }}>Platform Breakdown</Text>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={platformData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grayLight} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="count" fill={colors.green} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className={styles.card} style={{ flex: "1 1 100%" }}>
        <Text style={{ fontWeight: 600, marginBottom: "12px", display: "block" }}>All Agents</Text>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Platform</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Invocations (7d)</TableHeaderCell>
              <TableHeaderCell>Success Rate</TableHeaderCell>
              <TableHeaderCell>Avg Latency</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.agents.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{a.name}</TableCell>
                <TableCell>{a.platform}</TableCell>
                <TableCell>
                  <Badge
                    appearance="filled"
                    color={a.status === "active" ? "success" : a.status === "inactive" ? "danger" : "warning"}
                  >
                    {a.status}
                  </Badge>
                </TableCell>
                <TableCell>{a.invocations7d.toLocaleString()}</TableCell>
                <TableCell>{(a.successRate * 100).toFixed(1)}%</TableCell>
                <TableCell>{a.avgLatencyMs}ms</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
