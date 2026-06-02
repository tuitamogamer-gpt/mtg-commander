import type { FastifyError, FastifyInstance } from "fastify";

/**
 * Error-tracking hook. Stubbed so the app has zero hard dependency on Sentry.
 * To enable real tracking: `pnpm add @sentry/node`, set SENTRY_DSN, and replace
 * the body below with `Sentry.init({ dsn })` + capture in the error handler.
 */
export function initObservability(app: FastifyInstance): void {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    app.log.info("SENTRY_DSN set — wire @sentry/node here to enable error tracking.");
  }

  // Always capture unhandled route errors to the logger (and Sentry when wired).
  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error({ err, url: req.url }, "request error");
    // if (dsn) Sentry.captureException(err);
    const status = err.statusCode ?? 500;
    reply.code(status).send({ error: status >= 500 ? "Internal server error" : err.message });
  });
}
