import { createLightTheme, type BrandVariants } from "@fluentui/react-components";

const brand: BrandVariants = {
  10: "#050205",
  20: "#1a1218",
  30: "#2d1b2b",
  40: "#3d233c",
  50: "#4e2c4d",
  60: "#0078D4",
  70: "#1a86d9",
  80: "#0078D4",
  90: "#4da3e0",
  100: "#66b0e5",
  110: "#80bfea",
  120: "#99ccef",
  130: "#b3d9f4",
  140: "#cce6f9",
  150: "#e6f2fc",
  160: "#f5f9fe",
};

export const agentPulseTheme = {
  ...createLightTheme(brand),
  colorNeutralBackground1: "#FFFFFF",
  colorNeutralBackground2: "#FAF9F8",
  colorNeutralBackground3: "#F3F2F1",
};

export const colors = {
  bg: "#FAF9F8",
  card: "#FFFFFF",
  blue: "#0078D4",
  blueDark: "#004578",
  green: "#107C10",
  greenLight: "#DFF6DD",
  orange: "#FF8C00",
  orangeLight: "#FFF4CE",
  red: "#D13438",
  redLight: "#FDE7E9",
  gray: "#605E5C",
  grayLight: "#E1DFDD",
};
