import { buildApp } from "./app";

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      port: app.gatewayEnv.PORT,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error, "failed to start server");
    process.exit(1);
  }
}

void start();
