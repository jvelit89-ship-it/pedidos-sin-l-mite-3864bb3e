import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

const OFFICIAL_HOST = "pedidos.innsanma.com";
const LEGACY_VERCEL_HOST = "crmpedidosonline.vercel.app";
const LEGACY_CACHE_RESET_KEY = "pedidos_legacy_sw_reset_v1";

const CHUNK_RELOAD_KEY = "pedidos_chunk_reload_once";

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();

  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "done") {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return;
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, "done");

  void (async () => {
    try {
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } finally {
      window.location.reload();
    }
  })();
});

window.addEventListener("pageshow", () => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
});

if (window.location.hostname === LEGACY_VERCEL_HOST) {
  const target =
    `https://${OFFICIAL_HOST}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
} else {
  void clearLegacyServiceWorkers();

  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

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
