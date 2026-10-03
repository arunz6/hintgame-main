const LOCAL_ORIGINS = ["http://localhost:5173"];

export function getAllowedOrigins() {
  const configuredOrigins = process.env.FRONTEND_URL
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!configuredOrigins?.length) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FRONTEND_URL must contain the deployed frontend origin in production.");
    }
    return LOCAL_ORIGINS;
  }

  const origins = configuredOrigins.map((origin) => {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid frontend origin in FRONTEND_URL: ${origin}`);
    }
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin ||
      (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")
    ) {
      throw new Error(`FRONTEND_URL must be an exact origin and use HTTPS in production: ${origin}`);
    }
    return parsed.origin;
  });

  if (origins.includes("*")) {
    throw new Error("Wildcard origins are not allowed for frontend access.");
  }
  return origins;
}
