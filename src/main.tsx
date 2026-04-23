import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext";
import { BranchProvider } from "./contexts/BranchContext";
import { CompanyScopeProvider } from "./contexts/CompanyScopeContext";
import { StatusToastProvider } from "./contexts/StatusToastContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <StatusToastProvider>
        <CompanyScopeProvider>
          <BranchProvider>
            <App />
          </BranchProvider>
        </CompanyScopeProvider>
      </StatusToastProvider>
    </AuthProvider>
  </StrictMode>,
);