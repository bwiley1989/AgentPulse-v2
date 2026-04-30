import React from "react";
import ReactDOM from "react-dom/client";
import { FluentProvider } from "@fluentui/react-components";
import { agentPulseTheme } from "./theme";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FluentProvider theme={agentPulseTheme}>
      <App />
    </FluentProvider>
  </React.StrictMode>
);
