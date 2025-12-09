import App from "./App.svelte";

const app = new App({
  target: document.getElementById("app") as HTMLElement,
});

export default app;

// Register PWA service worker (works in production builds)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore registration errors silently
    });
  });
}
