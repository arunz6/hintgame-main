const LOCAL_ORIGINS = ["http://localhost:5173"];

function parseOrigin(value, label) {
  if (!value) return null;

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${label} must use http or https: ${value}`);
  }

  if (parsed.origin !== value && parsed.href !== `${value}/`) {
    throw new Error(`${label} must be an exact origin: ${value}`);
  }

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS in production: ${value}`);
  }

  return parsed.origin;
}

export function getAllowedOrigins() {
  const configuredOrigins = [
    ...(process.env.FRONTEND_URL?.split(",") ?? []),
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ]
    .map((origin) => origin?.trim())
    .filter(Boolean);

  if (!configuredOrigins.length) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FRONTEND_URL must contain the deployed frontend origin in production.");
    }
    return LOCAL_ORIGINS;
  }

  const origins = [...new Set(configuredOrigins.map((origin) => parseOrigin(origin, "FRONTEND_URL")))];

  if (origins.includes("*")) {
    throw new Error("Wildcard origins are not allowed for frontend access.");
  }
  return origins;
}
