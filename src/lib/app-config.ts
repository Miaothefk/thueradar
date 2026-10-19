export type AppConfig = {
  mode: "demo" | "configured";
  databaseConfigured: boolean;
  aiConfigured: boolean;
  schedulerConfigured: boolean;
  hasMissingSetup: boolean;
};

export function getAppConfig(): AppConfig {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.AZURE_OPENAI_API_KEY);
  const schedulerConfigured = Boolean(process.env.SYNC_SCHEDULE_CRON || process.env.CRON_EXPRESSION);

  return {
    mode: databaseConfigured || aiConfigured ? "configured" : "demo",
    databaseConfigured,
    aiConfigured,
    schedulerConfigured,
    hasMissingSetup: !databaseConfigured || !aiConfigured || !schedulerConfigured,
  };
}
