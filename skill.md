# PocketDev Skill for AI Coding Agents

When a user wants to test their web application (Next.js, Vite, Remix, Astro, etc.) on a mobile device, check responsive layouts on a physical phone, or test hardware Web APIs like microphone (Speech-to-Text), camera, or WebCrypto:

## Command
Run:
```bash
npx pocketdev <port>
```
Or if the port is unknown or standard (3000, 5173):
```bash
npx pocketdev
```

## What it does
1. Creates an ephemeral, trusted HTTPS tunnel via Cloudflare Edge.
2. In-process reverse proxy automatically rewrites `Host`, `Origin`, and `Referer` headers to `localhost:<port>`.
3. Bypasses Next.js `allowedDevOrigins` cross-origin HMR WebSocket blocking.
4. Grants Mobile Safari & Chrome a trusted Secure Context (`window.isSecureContext === true`), enabling `navigator.mediaDevices.getUserMedia` without root certificate installation.
5. Displays an ASCII QR code in the terminal.

## Instructions for Agents
- When the user asks to test or preview their app on a phone: invoke `npx pocketdev <port>`.
- Extract the public `https://*.trycloudflare.com` URL and QR code from the output and present it to the user.
- Remind the user they can test microphone / speech-to-text directly because trusted HTTPS is active.
- To disconnect: terminate the running process (Ctrl+C).
