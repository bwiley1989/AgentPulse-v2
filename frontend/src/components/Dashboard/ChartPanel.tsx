import React from "react";
import { Card, Text, makeStyles } from "@fluentui/react-components";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { colors } from "../../theme";

const useStyles = makeStyles({
  card: {
    padding: "20px",
    backgroundColor: colors.card,
    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
    borderRadius: "8px",
    flex: "1 1 45%",
    minWidth: "340px",
  },
  title: { fontSize: "14px", fontWeight: 600, color: "#323130", marginBottom: "16px", display: "block" },
});

interface Props {
  title: string;
  data: { date: string; value: number }[];
  type?: "line" | "bar";
  color?: string;
}

export default function ChartPanel({ title, data, type = "line", color = colors.blue }: Props) {
  const styles = useStyles();

  return (
    <Card className={styles.card}>
      <Text className={styles.title}>{title}</Text>
      <ResponsiveContainer width="100%" height={200}>
        {type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grayLight} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grayLight} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
}
