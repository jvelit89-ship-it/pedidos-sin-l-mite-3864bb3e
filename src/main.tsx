import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

const LEGACY_CACHE_RESET_KEY = "pedidos_legacy_sw_reset_v1";

async function clearLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return;

    const wasControlled = Boolean(navigator.serviceWorker.controller);
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    if (wasControlled && sessionStorage.getItem(LEGACY_CACHE_RESET_KEY) !== "done") {
      sessionStorage.setItem(LEGACY_CACHE_RESET_KEY, "done");
      window.location.reload();
    }
  } catch (error) {
    console.warn("Legacy service worker cleanup failed:", error);
  }
}

void clearLegacyServiceWorkers();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
