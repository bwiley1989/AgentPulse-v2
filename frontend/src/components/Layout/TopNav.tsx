import React from "react";
import { TabList, Tab } from "@fluentui/react-components";

const tabs = ["overview", "security", "usage", "health", "agents"] as const;

interface Props {
  current: string;
  onTabChange: (tab: string) => void;
}

export default function TopNav({ current, onTabChange }: Props) {
  return (
    <TabList
      selectedValue={current}
      onTabSelect={(_, d) => onTabChange(d.value as string)}
      size="medium"
    >
      {tabs.map((t) => (
        <Tab key={t} value={t}>
          {t.charAt(0).toUpperCase() + t.slice(1)}
        </Tab>
      ))}
    </TabList>
  );
}
