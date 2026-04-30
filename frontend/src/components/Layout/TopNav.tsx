import React from "react";
import { TabList, Tab } from "@fluentui/react-components";

const tabs = [
  { value: "overview", label: "Overview", route: "" },
  { value: "security", label: "Security", route: "security" },
  { value: "usage", label: "Usage", route: "usage" },
  { value: "health", label: "Health", route: "health" },
  { value: "agents", label: "Agents", route: "agents" },
] as const;

interface Props {
  current: string;
  onTabChange: (tab: string) => void;
}

export default function TopNav({ current, onTabChange }: Props) {
  return (
    <TabList
      selectedValue={current}
      onTabSelect={(_, d) => {
        const tab = tabs.find((t) => t.value === d.value);
        if (tab) {
          onTabChange(tab.value);
        }
      }}
      size="medium"
    >
      {tabs.map((t) => (
        <Tab key={t.value} value={t.value}>
          {t.label}
        </Tab>
      ))}
    </TabList>
  );
}
