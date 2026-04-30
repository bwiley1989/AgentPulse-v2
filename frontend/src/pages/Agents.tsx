import React, { useEffect, useState, useMemo } from "react";
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
  Button,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
} from "@fluentui/react-components";
import {
  Dismiss24Regular,
  ArrowSortDown20Regular,
  ArrowSortUp20Regular,
} from "@fluentui/react-icons";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api, Period } from "../api";
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
    flex: "1 1 45%",
    minWidth: "340px",
  },
  headingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: { fontSize: "24px", fontWeight: 700, color: "#201F1E" },
  sortableHeader: {
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    ":hover": { color: colors.blue },
  },
  clickableRow: {
    cursor: "pointer",
    ":hover": { backgroundColor: "#F3F2F1" },
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "140px 1fr",
    gap: "8px 16px",
    fontSize: "14px",
  },
  detailLabel: { fontWeight: 600, color: colors.gray },
});

interface Props {
  tenantId: string;
}

type SortKey = "name" | "platform" | "status" | "invocations7d" | "successRate" | "avgLatencyMs";
type SortDir = "asc" | "desc";

export default function Agents({ tenantId }: Props) {
  const styles = useStyles();
  const [data, setData] = useState<any>(null);
  const [period, setPeriod] = useState<Period>("D7");
  const [sortKey, setSortKey] = useState<SortKey>("invocations7d");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedAgent, setSelectedAgent] = useState<any>(null);

  useEffect(() => {
    if (tenantId) {
      setData(null);
      api.agents(tenantId, period).then(setData);
    }
  }, [tenantId, period]);

  const sortedAgents = useMemo(() => {
    if (!data?.agents) return [];
    return [...data.agents].sort((a: any, b: any) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data?.agents, sortKey, sortDir]);

  if (!data) return <Spinner label="Loading agents..." />;

  const platformData = Object.entries(data.platformBreakdown || {}).map(([name, count]) => ({ name, count }));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ArrowSortUp20Regular style={{ fontSize: "14px" }} />
    ) : (
      <ArrowSortDown20Regular style={{ fontSize: "14px" }} />
    );
  };

  const columns: { key: SortKey; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "platform", label: "Platform" },
    { key: "status", label: "Status" },
    { key: "invocations7d", label: "Invocations (7d)" },
    { key: "successRate", label: "Success Rate" },
    { key: "avgLatencyMs", label: "Avg Latency" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.headingRow}>
        <Text className={styles.heading}>Agent Registry</Text>
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
              {columns.map((col) => (
                <TableHeaderCell key={col.key}>
                  <div className={styles.sortableHeader} onClick={() => handleSort(col.key)}>
                    {col.label}
                    <SortIcon col={col.key} />
                  </div>
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAgents.map((a: any) => (
              <TableRow
                key={a.id}
                className={styles.clickableRow}
                onClick={() => setSelectedAgent(a)}
              >
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

      {/* Agent Detail Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={(_, d) => { if (!d.open) setSelectedAgent(null); }}>
        <DialogSurface style={{ maxWidth: "480px" }}>
          <DialogTitle
            action={
              <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={() => setSelectedAgent(null)} />
            }
          >
            {selectedAgent?.name}
          </DialogTitle>
          <DialogBody>
            <DialogContent>
              {selectedAgent && (
                <div className={styles.detailGrid}>
                  <span className={styles.detailLabel}>Platform</span>
                  <span>{selectedAgent.platform}</span>
                  <span className={styles.detailLabel}>Status</span>
                  <span>
                    <Badge
                      appearance="filled"
                      color={selectedAgent.status === "active" ? "success" : selectedAgent.status === "inactive" ? "danger" : "warning"}
                    >
                      {selectedAgent.status}
                    </Badge>
                  </span>
                  <span className={styles.detailLabel}>Invocations (7d)</span>
                  <span>{selectedAgent.invocations7d.toLocaleString()}</span>
                  <span className={styles.detailLabel}>Success Rate</span>
                  <span>{(selectedAgent.successRate * 100).toFixed(1)}%</span>
                  <span className={styles.detailLabel}>Avg Latency</span>
                  <span>{selectedAgent.avgLatencyMs}ms</span>
                  {selectedAgent.description && (
                    <>
                      <span className={styles.detailLabel}>Description</span>
                      <span>{selectedAgent.description}</span>
                    </>
                  )}
                  {selectedAgent.owner && (
                    <>
                      <span className={styles.detailLabel}>Owner</span>
                      <span>{selectedAgent.owner}</span>
                    </>
                  )}
                </div>
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
