const configuredUrl = import.meta.env.VITE_SERVER_URL?.trim();
export const serverUrl = configuredUrl || (import.meta.env.DEV ? "http://localhost:3000" : "");

if (configuredUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("VITE_SERVER_URL must be an absolute backend origin.");
  }

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.origin !== configuredUrl.replace(/\/$/, "") ||
    (import.meta.env.PROD && parsedUrl.protocol !== "https:")
  ) {
    throw new Error("VITE_SERVER_URL must be an exact HTTPS backend origin in production.");
  }
}
