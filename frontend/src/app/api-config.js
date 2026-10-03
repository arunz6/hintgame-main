const configuredUrl = import.meta.env.VITE_SERVER_URL?.trim();

if (!configuredUrl && import.meta.env.PROD) {
  throw new Error("VITE_SERVER_URL must be set to the backend origin before building for production.");
}

export const serverUrl = configuredUrl || "http://localhost:3000";
let parsedUrl;
try {
  parsedUrl = new URL(serverUrl);
} catch {
  throw new Error("VITE_SERVER_URL must be an absolute backend origin.");
}

if (
  !["http:", "https:"].includes(parsedUrl.protocol) ||
  parsedUrl.origin !== serverUrl.replace(/\/$/, "") ||
  (import.meta.env.PROD && parsedUrl.protocol !== "https:")
) {
  throw new Error("VITE_SERVER_URL must be an exact HTTPS backend origin in production.");
}
