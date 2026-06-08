import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const rootLogger = pino(
  isDev
    ? {
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {
        level: "info",
      }
);

export default rootLogger;

export function child(bindings: Record<string, unknown>) {
  return rootLogger.child(bindings);
}
