self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // cleanup if needed
});

self.addEventListener("fetch", (event) => {
  // simple passthrough; workbox handled by vite-plugin-pwa if enabled
});
