import React, { useState } from "react";
import { makeStyles, tokens, Text } from "@fluentui/react-components";
import {
  ChevronDown20Regular,
  ChevronRight20Regular,
  Board20Regular,
  PlugConnected20Regular,
  Search20Regular,
  Settings20Regular,
  Bot20Regular,
  Apps20Regular,
  Wrench20Regular,
} from "@fluentui/react-icons";
import { colors } from "../../theme";

const useStyles = makeStyles({
  sidebar: {
    width: "260px",
    minWidth: "260px",
    backgroundColor: "#FFFFFF",
    borderRight: `1px solid ${colors.grayLight}`,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  logo: {
    padding: "20px 16px",
    fontWeight: 700,
    fontSize: "16px",
    color: colors.blueDark,
    borderBottom: `1px solid ${colors.grayLight}`,
  },
  section: { marginTop: "4px" },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "13px",
    color: colors.gray,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    ":hover": { backgroundColor: colors.bg },
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 16px 8px 40px",
    cursor: "pointer",
    fontSize: "14px",
    color: "#323130",
    ":hover": { backgroundColor: colors.bg },
  },
  itemActive: {
    backgroundColor: "#EBF3FC",
    color: colors.blue,
    fontWeight: 600,
    borderLeft: `3px solid ${colors.blue}`,
    paddingLeft: "37px",
  },
});

const sections = [
  {
    title: "Copilot",
    items: [
      { label: "Overview", path: "/", icon: <Board20Regular /> },
      { label: "Connectors", path: "/connectors", icon: <PlugConnected20Regular /> },
      { label: "Search", path: "/search", icon: <Search20Regular /> },
      { label: "Settings", path: "/copilot-settings", icon: <Settings20Regular /> },
    ],
  },
  {
    title: "Agents",
    items: [
      { label: "Overview", path: "/agents", icon: <Bot20Regular /> },
      { label: "All agents", path: "/agents/all", icon: <Apps20Regular /> },
      { label: "Tools", path: "/agents/tools", icon: <Wrench20Regular /> },
      { label: "Settings", path: "/agents/settings", icon: <Settings20Regular /> },
    ],
  },
];

interface Props {
  onNavigate: (path: string) => void;
  activePath: string;
}

export default function Sidebar({ onNavigate, activePath }: Props) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Copilot: true, Agents: true });

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>⚡ AgentPulse</div>
      {sections.map((s) => (
        <div key={s.title} className={styles.section}>
          <div className={styles.sectionHeader} onClick={() => setExpanded((p) => ({ ...p, [s.title]: !p[s.title] }))}>
            {expanded[s.title] ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
            {s.title}
          </div>
          {expanded[s.title] &&
            s.items.map((item) => (
              <div
                key={item.path}
                className={`${styles.item} ${activePath === item.path ? styles.itemActive : ""}`}
                onClick={() => onNavigate(item.path)}
              >
                {item.icon}
                <Text>{item.label}</Text>
              </div>
            ))}
        </div>
      ))}
    </nav>
  );
}
