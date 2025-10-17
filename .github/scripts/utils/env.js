export const maybeLoadDotenv = async () => {
  const isCI = process.env.GITHUB_ACTIONS === "true" || process.env.CI === "true";
  if (!isCI) {
    try {
      const dotenv = await import("dotenv");
      dotenv.default?.config?.() || dotenv.config?.();
    } catch (error) {
      if (
        error?.code === "ERR_MODULE_NOT_FOUND" ||
        (typeof error?.message === "string" && error.message.includes("Cannot find module"))
      ) {
        return;
      }
      throw error;
    }
  }
};
