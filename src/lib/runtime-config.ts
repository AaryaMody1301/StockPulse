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

export function getRuntimeConfigurationStatus(
  env: EnvLike = process.env,
): RuntimeConfigurationStatus {
  const marketProviders: string[] = [];
  if (hasValue(env.FINNHUB_API_KEY)) marketProviders.push("finnhub");
  if (hasValue(env.TWELVEDATA_API_KEY)) marketProviders.push("twelvedata");

  const secUserAgent = env.SEC_USER_AGENT?.trim() ?? "";
  const secIngestionConfigured = Boolean(
    secUserAgent
    && !/contact@example\.com/i.test(secUserAgent)
    && /\S+@\S+\.\S+/.test(secUserAgent),
  );

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
