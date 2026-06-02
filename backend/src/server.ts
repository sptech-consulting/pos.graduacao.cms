import Fastify from "fastify";
import { config } from "./config.js";
import { registerCookie } from "./plugins/cookie.js";
import { registerCors } from "./plugins/cors.js";
import { registerJwt } from "./plugins/jwt.js";
import { registerRateLimit } from "./plugins/rate-limit.js";
import { registerSwagger } from "./plugins/swagger.js";
import { authRoutes } from "./routes/auth/index.js";
import { adminAmbientesRoutes } from "./routes/admin/ambientes.js";
import { adminCursosRoutes } from "./routes/admin/cursos.js";
import { adminAlunosRoutes } from "./routes/admin/alunos.js";
import { adminTrabalhosRoutes } from "./routes/admin/trabalhos.js";
import { adminFerramentasRoutes } from "./routes/admin/ferramentas.js";
import { adminUsuariosRoutes } from "./routes/admin/usuarios.js";
import { healthRoutes } from "./routes/health.js";

const isProd = config.NODE_ENV === "production";

const app = Fastify({
  logger: isProd ? true : { transport: { target: "pino-pretty", options: { colorize: true } } },
});

app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
  const statusCode = error.statusCode ?? 500;
  app.log.error(error);
  reply.status(statusCode).send({
    statusCode,
    error: error.name ?? "Internal Server Error",
    message: isProd && statusCode >= 500 ? "Internal Server Error" : error.message,
  });
});

app.setNotFoundHandler((_req, reply) => {
  reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Not found" });
});

async function start(): Promise<void> {
  // Swagger must be registered before routes so it can collect schemas
  await registerSwagger(app);

  await registerCors(app);
  await registerRateLimit(app);
  await registerCookie(app);
  await registerJwt(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(adminUsuariosRoutes);
  await app.register(adminAmbientesRoutes);
  await app.register(adminCursosRoutes);
  await app.register(adminFerramentasRoutes);
  await app.register(adminAlunosRoutes);
  await app.register(adminTrabalhosRoutes);

  await app.listen({ port: config.BACKEND_PORT, host: "0.0.0.0" });
}

async function shutdown(): Promise<void> {
  await app.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
