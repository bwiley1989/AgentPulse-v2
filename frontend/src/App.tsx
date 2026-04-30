import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { makeStyles } from "@fluentui/react-components";
import Sidebar from "./components/Layout/Sidebar";
import TopNav from "./components/Layout/TopNav";
import TenantSelector from "./components/TenantSelector";
import Overview from "./pages/Overview";
import Agents from "./pages/Agents";
import Security from "./pages/Security";
import Usage from "./pages/Usage";
import Health from "./pages/Health";
import { api, type Tenant } from "./api";
import { colors } from "./theme";

const useStyles = makeStyles({
  root: { display: "flex", height: "100vh", backgroundColor: colors.bg },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 24px",
    backgroundColor: "#FFFFFF",
    borderBottom: `1px solid ${colors.grayLight}`,
  },
  content: { flex: 1, overflow: "auto", padding: "24px" },
});

function Shell() {
  const styles = useStyles();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const navigate = useNavigate();
  const location = useLocation();

  const loadTenants = useCallback(() => {
    api.tenants().then((t) => {
      setTenants(t);
      if (t.length && !t.find((x) => x.id === selectedTenant)) {
        setSelectedTenant(t[0].id);
      }
    });
  }, [selectedTenant]);

  useEffect(() => {
    loadTenants();
  }, []);

  const currentTab = location.pathname.split("/")[1] || "overview";

  return (
    <div className={styles.root}>
      <Sidebar onNavigate={(path) => navigate(path)} activePath={location.pathname} />
      <div className={styles.main}>
        <div className={styles.topBar}>
          <TopNav current={currentTab} onTabChange={(t) => navigate(`/${t === "overview" ? "" : t}`)} />
          <TenantSelector
            tenants={tenants}
            selected={selectedTenant}
            onChange={setSelectedTenant}
            onTenantsChanged={loadTenants}
          />
        </div>
        <div className={styles.content}>
          <Routes>
            <Route path="/" element={<Overview tenantId={selectedTenant} />} />
            <Route path="/agents" element={<Agents tenantId={selectedTenant} />} />
            <Route path="/security" element={<Security tenantId={selectedTenant} />} />
            <Route path="/usage" element={<Usage tenantId={selectedTenant} />} />
            <Route path="/health" element={<Health tenantId={selectedTenant} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
