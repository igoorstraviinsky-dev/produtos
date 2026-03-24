import { AppEnv } from "./env";

export function createLoggerOptions(env: AppEnv) {
  return {
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === "development"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true
            }
          }
        : undefined
  };
}
