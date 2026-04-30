import React, { useState } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Button,
  Input,
  Label,
  Spinner,
  makeStyles,
  Field,
} from "@fluentui/react-components";
import {
  Dismiss24Regular,
  CheckmarkCircle20Regular,
  ErrorCircle20Regular,
} from "@fluentui/react-icons";
import { api, type ConnectTenantPayload } from "../api";
import { colors } from "../theme";

const useStyles = makeStyles({
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    paddingTop: "12px",
  },
  feedback: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
  },
});

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export default function ConnectTenantDialog({ open, onClose, onConnected }: Props) {
  const styles = useStyles();
  const [displayName, setDisplayName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const reset = () => {
    setDisplayName("");
    setTenantId("");
    setClientId("");
    setClientSecret("");
    setFeedback(null);
    setTesting(false);
    setConnecting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const result = await api.testTenant(tenantId || "new", {
        tenant_id: tenantId,
        client_id: clientId,
        client_secret: clientSecret,
      });
      setFeedback({
        type: result.success ? "success" : "error",
        message: result.message || (result.success ? "Connection successful!" : "Connection failed"),
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Test failed" });
    }
    setTesting(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    setFeedback(null);
    try {
      const payload: ConnectTenantPayload = {
        display_name: displayName,
        tenant_id: tenantId,
        client_id: clientId,
        client_secret: clientSecret,
      };
      await api.connectTenant(payload);
      setFeedback({ type: "success", message: "Tenant connected successfully!" });
      setTimeout(() => {
        handleClose();
        onConnected();
      }, 1000);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Connection failed" });
      setConnecting(false);
    }
  };

  const canTest = tenantId.length > 0 && clientId.length > 0 && clientSecret.length > 0;
  const canConnect = displayName.length > 0 && canTest;

  return (
    <Dialog open={open} onOpenChange={(_, d) => { if (!d.open) handleClose(); }}>
      <DialogSurface style={{ maxWidth: "520px" }}>
        <DialogTitle
          action={
            <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={handleClose} />
          }
        >
          Connect Microsoft 365 Tenant
        </DialogTitle>
        <DialogBody>
          <DialogContent>
            <div className={styles.form}>
              <Field label="Display Name" required>
                <Input
                  placeholder="e.g., Contoso Ltd"
                  value={displayName}
                  onChange={(_, d) => setDisplayName(d.value)}
                />
              </Field>
              <Field label="Tenant ID" required>
                <Input
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={tenantId}
                  onChange={(_, d) => setTenantId(d.value)}
                />
              </Field>
              <Field label="Client ID (App Registration)" required>
                <Input
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={clientId}
                  onChange={(_, d) => setClientId(d.value)}
                />
              </Field>
              <Field label="Client Secret" required>
                <Input
                  type="password"
                  placeholder="Enter client secret"
                  value={clientSecret}
                  onChange={(_, d) => setClientSecret(d.value)}
                />
              </Field>

              {feedback && (
                <div
                  className={styles.feedback}
                  style={{
                    backgroundColor: feedback.type === "success" ? colors.greenLight : colors.redLight,
                    color: feedback.type === "success" ? colors.green : colors.red,
                  }}
                >
                  {feedback.type === "success" ? <CheckmarkCircle20Regular /> : <ErrorCircle20Regular />}
                  {feedback.message}
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="outline"
              onClick={handleTest}
              disabled={!canTest || testing}
              icon={testing ? <Spinner size="tiny" /> : undefined}
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            <Button
              appearance="primary"
              onClick={handleConnect}
              disabled={!canConnect || connecting}
              icon={connecting ? <Spinner size="tiny" /> : undefined}
            >
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
