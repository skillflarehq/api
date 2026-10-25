import { spawn } from "node:child_process";
import Fastify from "fastify";

const port = Number(process.env.PORT) || 4000;

const app = Fastify({ logger: true });

app.get("/", async () => {
  return { ok: true };
});

app.post("/", async (request, reply) => {
  request.log.info(
    {
      event: request.headers["x-webhook-event"],
      deliveryId: request.headers["x-webhook-delivery-id"],
      headers: request.headers,
      body: request.body,
    },
    "webhook received",
  );
  return reply.code(200).send({ ok: true });
});

await app.listen({ host: "0.0.0.0", port });

const ngrok = spawn(
  "ngrok",
  ["http", String(port), "--log", "stdout", "--log-format", "logfmt", "--log-level", "warn"],
  { stdio: ["ignore", "inherit", "inherit"] },
);

let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  try {
    ngrok.kill("SIGTERM");
  } catch {
    // The process may already be gone.
  }
  app.close().finally(() => process.exit(code));
}

ngrok.on("error", (error) => {
  app.log.error({ err: error }, "ngrok failed to start");
  stop(1);
});

ngrok.on("exit", (code, signal) => {
  if (stopping) return;
  if (code !== 0) {
    app.log.error({ code, signal }, "ngrok exited");
  }
  stop(code === 0 || signal ? 0 : (code ?? 1));
});

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

try {
  const url = await waitForForwardingUrl(port);
  console.log(`\nForwarding  ${url} -> http://127.0.0.1:${port}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  app.log.error(message);
}

async function waitForForwardingUrl(localPort) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (stopping) {
      throw new Error("ngrok exited before a tunnel was ready");
    }
    try {
      const response = await fetch("http://127.0.0.1:4040/api/tunnels");
      if (response.ok) {
        const body = await response.json();
        const tunnel = (body.tunnels ?? []).find((item) => {
          const publicUrl = item.public_url ?? "";
          const addr = String(item.config?.addr ?? "");
          return publicUrl.startsWith("https://") && addr.endsWith(`:${localPort}`);
        });
        if (tunnel) return tunnel.public_url;
      }
    } catch {
      // The local inspector is not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    "Timed out waiting for the ngrok forwarding URL. Check the ngrok log above.",
  );
}
