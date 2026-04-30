import React from "react";
import { Badge } from "@fluentui/react-components";
import { colors } from "../theme";

interface Props {
  source?: "live" | "mock" | string;
  style?: React.CSSProperties;
}

export default function DataSourceBadge({ source, style }: Props) {
  if (!source) return null;

  const isLive = source === "live";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 600,
        backgroundColor: isLive ? colors.greenLight : "#F3F2F1",
        color: isLive ? colors.green : colors.gray,
        ...style,
      }}
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          backgroundColor: isLive ? colors.green : "#A19F9D",
          display: "inline-block",
        }}
      />
      {isLive ? "Live Data" : "Demo Data"}
    </span>
  );
}
