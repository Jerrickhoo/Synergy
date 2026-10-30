import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { AppProvider } from "./state/AppContext.jsx";
import "./styles.css";
import "./planning.css";
import "./discovery.css";
import "./match-overlays.css";
import "./shared-ui.css";
import "./profile-pages.css";
import "./mentorship.css";
import "./theme.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
