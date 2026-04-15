import { useEffect } from "react";
import { setupVaultRouter } from "./messaging/router";

const MAIN_APP_ORIGIN =
  import.meta.env.VITE_MAIN_APP_ORIGIN || "http://localhost:5173";

export default function App() {
  useEffect(() => {
    const cleanup = setupVaultRouter(MAIN_APP_ORIGIN);

    window.parent.postMessage(
      {
        type: "vault.ready",
      },
      MAIN_APP_ORIGIN,
    );

    return cleanup;
  }, []);

  return (
    <div style={{ padding: 16, fontFamily: "Arial, sans-serif" }}>
      <h2>Data Vault</h2>
      <p>Vault is running and listening for messages.</p>
    </div>
  );
}
