# Skillflare webhook receiver

A small Fastify server that accepts outbound Skillflare webhooks and prints each delivery. ngrok gives the process a temporary public HTTPS URL so Skillflare can reach your machine.

Skillflare sends one `POST` per event. Headers include `Content-Type: application/json`, `User-Agent: Skillflare-Webhooks/1.0`, `X-Webhook-Event` (for example `SESSION.STARTED`), and `X-Webhook-Delivery-Id`. The JSON body has `type` and `data.session`. Any HTTP 2xx within 10 seconds counts as success. This server replies `200` with `{ "ok": true }` and logs the event header, delivery id, and body.

Create the webhook on the dashboard **Webhooks** page. There is no public API for that.

## Prerequisites

- Node.js
- [ngrok](https://ngrok.com/download), already authenticated so `ngrok http` works

## Run the receiver and ngrok

From this directory:

```bash
cd webhook
npm install
npm start
```

`npm start` listens on `http://127.0.0.1:4000` and starts `ngrok http` on that same port. Set `PORT` to use another port; ngrok follows it. When the tunnel is ready, the terminal prints a line like:

```text
Forwarding  https://….ngrok-free.app -> http://127.0.0.1:4000
```

Copy that HTTPS URL. In the dashboard, create or edit a webhook:

1. Set the URL to that hostname. The path can stay `/`.
2. Subscribe at least to `SESSION.STARTED`.

`GET /` returns `{ "ok": true }` so you can confirm the process is up. Ctrl+C stops the server and ngrok together.

The hostname exists only while this process is running. Anyone who has the URL can `POST` to your machine. Stop it when you are done, and point the dashboard webhook somewhere else before you leave it.

## Read a delivery

Start a session from the dashboard or the Bruno collection in `bruno/` so Skillflare emits an event. The receiver terminal prints a `webhook received` log with `event`, `deliveryId`, and the JSON body. ngrok’s inspector at `http://127.0.0.1:4040` shows the same request and the `200` response.

A `200` means Skillflare will not retry that delivery. `408`, `429`, `5xx`, a timeout, or a network error is retried (up to 5 times). Other 4xx responses, including a path that is not `POST /`, are not retried.

## Caveats

- Free ngrok hostnames change every time you restart `npm start`. Update the dashboard URL when that happens.
- Do not leave a production webhook pointed at a tunnel URL.
