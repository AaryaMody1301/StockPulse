export interface RuntimeConfigurationStatus {
  databaseConfigured: boolean;
  marketDataConfigured: boolean;
  marketProviders: string[];
  secIngestionConfigured: boolean;
  aiConfigured: boolean;
  appUrlConfigured: boolean;
}

type EnvLike = Record<string, string | undefined>;

function hasValue(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasRealSecContact(userAgent: string): boolean {
  const email = userAgent.match(/\b[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})\b/i);
  if (!email?.[1]) return false;

  const domain = email[1].toLowerCase();
  if (["example.com", "example.net", "example.org"].includes(domain)) return false;
  if (domain === "example" || domain.endsWith(".example")) return false;
  return true;
}

export function getRuntimeConfigurationStatus(
  env: EnvLike = process.env,
): RuntimeConfigurationStatus {
  const marketProviders: string[] = [];
  if (hasValue(env.FINNHUB_API_KEY)) marketProviders.push("finnhub");
  if (hasValue(env.TWELVEDATA_API_KEY)) marketProviders.push("twelvedata");

  const secUserAgent = env.SEC_USER_AGENT?.trim() ?? "";
  const secIngestionConfigured = hasRealSecContact(secUserAgent);

  const aiKeyConfigured = hasValue(env.AI_GATEWAY_API_KEY) || hasValue(env.AI_API_KEY);

  return {
    databaseConfigured: hasValue(env.DATABASE_URL),
    marketDataConfigured: marketProviders.length > 0,
    marketProviders,
    secIngestionConfigured,
    aiConfigured: aiKeyConfigured && hasValue(env.AI_MODEL),
    appUrlConfigured: hasValue(env.NEXT_PUBLIC_APP_URL),
  };
}
