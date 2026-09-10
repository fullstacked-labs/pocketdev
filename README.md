# 🦘 devhop

[![npm version](https://img.shields.io/npm/v/devhop.svg)](https://www.npmjs.com/package/devhop)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Built for AI Agents](https://img.shields.io/badge/AI%20Agent-Skill%20Ready-purple.svg)](./skill.md)

> **Hop your local web dev server onto your phone in seconds. Instant trusted HTTPS, working Hot Module Reloading (HMR), and mobile camera/microphone permissions with zero configuration.**

```bash
npx devhop [port]
```

```text
 🦘 DEVHOP 

  Target:       http://localhost:3000
  Mobile URL:   https://breeze-sunset-vintage-glade.trycloudflare.com

  ✔ Host & Origin Masquerade active (Next.js & Vite HMR Safe)
  ✔ Trusted HTTPS active (Microphone, Camera & WebCrypto Permitted)
  ✔ Location, Cookie & Server Action redirect rewrites active
  ✔ Zero configuration, no accounts or root certs required

  Scan with your iPhone or Android camera:
  [ QR Code ]

  Press Ctrl+C to stop the tunnel and disconnect.
```

---

## The Problem: Mobile Web Dev is Broken in 2026

When you try testing your Next.js, Vite, Remix, or Astro app on a physical iPhone or Android device, you hit three brick walls:

### 1. The HMR Wall (Cross-Origin Blocking)
Modern frameworks have hardened their dev servers against Cross-Site WebSocket hijacking:
* **Next.js 14–16**: Rejects WebSocket upgrades and dev chunk loading from external hostnames:
  ```text
  Blocked cross-origin request to Next.js dev resource /_next/static/webpack/...
  To allow this host in development, add it to "allowedDevOrigins" in next.config.js
  ```
* **Next.js Server Actions**: Rejects POST actions because the incoming origin does not match the forwarded host:
  ```text
  Error: Invalid Server Actions request.
  ```
* **Vite 6 & Webpack**: Rejects external Host headers to prevent DNS rebinding:
  ```text
  Blocked request. This host is not allowed.
  ```

Editing `allowedDevOrigins` or hardcoding your LAN IP in config files breaks git branches, CI, and coffee shop Wi-Fi changes.

### 2. The Secure Context Wall (`isSecureContext === false`)
Mobile Safari and Android Chrome hard-disable modern Web APIs over plain LAN HTTP (`http://192.168.x.x:3000`):
* `navigator.mediaDevices.getUserMedia` is `undefined` (Microphone and Camera tests fail immediately).
* `crypto.subtle` (WebCrypto) and Web Authentication / Passkeys are disabled.
* Async Clipboard API and Geolocation are blocked.

### 3. The Guest Wi-Fi & Client Isolation Wall
In offices, coffee shops, and conferences, Wi-Fi routers enforce Client Isolation, preventing your phone from reaching your laptop's LAN IP address directly.

---

## Comparison: Why devhop Beats the Alternatives

| Feature | **devhop** | **ngrok** | **unjs/untun** | **LocalCan** | **mkcert** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Setup Command** | `npx devhop` | CLI install + login | `npx untun` | $57 Mac App | Brew install |
| **Account / Signups** | **None** | Required | None | License key | None |
| **Trusted HTTPS (Green Padlock)** | **Yes** | Yes | Yes | Yes (local) | Manual iOS CA Profile |
| **Next.js 14–16 HMR & Fast Refresh** | **Yes** (In-process proxy) | ❌ Blocks cross-origin | ❌ Blocks cross-origin | ❌ Blocks cross-origin | ⚠️ LAN IP mismatch |
| **Next.js Server Actions CSRF Safe** | **Yes** (Origin aligned) | ❌ 500 CSRF abort | ❌ 500 CSRF abort | ❌ 500 CSRF abort | ⚠️ Protocol mismatch |
| **Vite 6 `allowedHosts` Compatible** | **Yes** (Host masquerade) | ❌ 403 Forbidden | ❌ 403 Forbidden | ❌ 403 Forbidden | ⚠️ Host mismatch |
| **Real-time SSE / Token Streaming** | **Yes** (Unbuffered) | Yes | Yes | Yes | Yes |
| **Terminal QR Code** | **Yes** (Compact Unicode) | ❌ URL only | ❌ URL only | ❌ Desktop UI only | ❌ None |
| **Free / Open Source** | **MIT (100% Free)** | $8+/mo after 1GB | MIT | $57 paid | MIT |

---

## Secure Context: Unlocked Mobile Web APIs

Because `devhop` terminates trusted TLS at Cloudflare's Edge, mobile Safari and Chrome grant your physical device full **Secure Context** permissions:

| Web API | `http://192.168.x.x` (LAN) | `npx devhop` | Use Case |
| :--- | :---: | :---: | :--- |
| **`navigator.mediaDevices.getUserMedia`** | ❌ `undefined` | ✅ **Permitted** | Speech-to-Text dictation, voice notes, camera scanner |
| **`crypto.subtle` (WebCrypto)** | ❌ Blocked | ✅ **Permitted** | JWT signing, encryption, client-side auth tokens |
| **Web Authentication (Passkeys)** | ❌ Blocked | ✅ **Permitted** | Biometric FaceID / TouchID login flows |
| **Async Clipboard (`navigator.clipboard`)** | ❌ Blocked | ✅ **Permitted** | 1-click copy buttons and rich clipboard reads |
| **Geolocation API** | ❌ Blocked | ✅ **Permitted** | GPS location testing on physical mobile hardware |
| **Progressive Web App (PWA) Install** | ❌ Blocked | ✅ **Permitted** | Testing "Add to Home Screen" on iOS Safari |

---

## How devhop Works

```
┌─────────────────┐       HTTPS       ┌─────────────────────────────┐
│  iPhone Safari  │ ────────────────▶ │ *.trycloudflare.com (Edge)  │
└─────────────────┘                   └─────────────────────────────┘
                                                     │
                                                     ▼ HTTP
                                      ┌─────────────────────────────┐
                                      │      devhop Micro-Proxy     │
                                      │ (Rewrites Host -> localhost)│
                                      └─────────────────────────────┘
                                                     │
                                                     ▼ Loopback
                                      ┌─────────────────────────────┐
                                      │ Next.js / Vite (Port 3000)  │
                                      └─────────────────────────────┘
```

1. **Header Masquerading**: Intercepts incoming requests and rewrites `Host`, `Origin`, and `Referer` to `localhost:<port>`, while normalizing `sec-fetch-site` to `same-origin`. Frameworks perceive the mobile connection as local loopback traffic, bypassing cross-origin blocks.
2. **Redirect & Server Action Rewrites**: Automatically rewrites `Location` and Next.js `x-action-redirect` response headers to ensure OAuth logins, form submissions, and Server Action redirects remain on the public mobile URL.
3. **Cookie Domain Stripping**: Automatically strips `Domain=localhost` and `Domain=[::1]` from `Set-Cookie` response headers so mobile Safari and Chrome properly store session cookies.
4. **Dev Server Reboot Resilience**: Catches `ECONNREFUSED` during Vite or Next.js rebuilds and returns a clean `502 Bad Gateway` with `Retry-After: 1` rather than crashing the process or hanging client sockets.
5. **Streaming & SSE**: Disables buffering on Server-Sent Events (`X-Accel-Buffering: no` and TCP `socket.setNoDelay(true)`) for smooth real-time AI token streaming.

---

## Quickstart

Run directly via `npx`:

```bash
# Auto-detects active dev server (Next.js, Vite, Astro, Nuxt, etc.)
npx devhop

# Specify port explicitly
npx devhop 3000

# Tolerant target syntax (paste directly from terminal output)
npx devhop localhost:5173
npx devhop 127.0.0.1:8080
npx devhop 0.0.0.0:4321
npx devhop http://localhost:5173
```

### CLI Options

```text
npx devhop                   Auto-detect active dev server port
npx devhop [target]          Expose port, host:port, or URL with QR code
npx devhop [target] --no-qr  Expose target without printing QR code
npx devhop [target] --json   Output tunnel JSON (for AI coding agents & scripts)
npx devhop --help            Show help message
npx devhop --version         Show version
```

---

## AI Agent Integration

`devhop` is built for modern AI coding agents (Claude Code, Cursor, Windsurf, OMP):
* **`skill.md`**: Implements the open Agent Skills specification so agents understand when and how to launch mobile tunnels.
* **`llms.txt`**: Curated machine-readable overview for LLM context retrieval.
* **`--json` Flag**: Run `npx devhop 3000 --json` to receive structured output:
  ```json
  {"url":"https://example.trycloudflare.com","target":"http://127.0.0.1:3000","port":3000,"host":"127.0.0.1"}
  ```

---

## License

MIT © [Noor Latif](https://github.com/noor-latif) · [Fullstacked](https://fullstacked.se)
