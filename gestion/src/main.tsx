import { createRoot } from "react-dom/client";
import App from "./App";
import { OAuthConsent } from "./OAuthConsent";
import "./styles.css";
createRoot(document.getElementById("root")!).render(location.pathname === "/oauth/consent" ? <OAuthConsent /> : <App />);
