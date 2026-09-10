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
  ✔ Location & Cookie domain rewrites active
  ✔ Zero configuration, no accounts or root certs required

  Scan with your iPhone or Android camera:
  [ QR Code ]

  Press Ctrl+C to stop the tunnel and disconnect.
```

---

## The Problem: Mobile Web Dev is Broken in 2026

When you try testing your Next.js, Vite, Remix, or Astro app on a physical iPhone or Android device, you hit two brick walls:

### 1. The HMR Wall (Cross-Origin Blocking)
Modern frameworks have hardened their dev servers against Cross-Site WebSocket hijacking:
* **Next.js 14–16**: Rejects WebSocket upgrades and dev chunk loading from external hostnames:
  ```text
  Blocked cross-origin request to Next.js dev resource /_next/static/webpack/...
  To allow this host in development, add it to "allowedDevOrigins" in next.config.js
  ```
* **Vite & Webpack**:
  ```text
  [vite] connecting... failed to connect to websocket.
  Invalid Host header.
  ```
Editing `allowedDevOrigins` or hardcoding your LAN IP in config files breaks git branches, CI, and coffee shop Wi-Fi changes.

### 2. The Secure Context Wall (`isSecureContext === false`)
Mobile Safari and Android Chrome hard-disable modern Web APIs over plain LAN HTTP (`http://192.168.x.x:3000`):
* `navigator.mediaDevices.getUserMedia` is `undefined` (Microphone and Camera tests fail immediately).
* `NotAllowedError: The request is not allowed by the user agent in the current context`.
* `crypto.subtle` and WebShare are disabled.

---

## Why Existing Tools Don't Cut It

| Tool | Trusted HTTPS? | Fixes Next.js / Vite HMR? | Account / Signup? | Setup Friction |
|---|---|---|---|---|
| **devhop** | **Yes** (Cloudflare Edge) | **Yes** (Header Masquerade) | **Zero (Anonymous)** | `npx devhop 3000` |
| **ngrok** | Yes | **No** (passes external Host; HMR dies) | Yes (Auth token required) | High |
| **cloudflared** | Yes | **No** (passes `*.trycloudflare.com` Host) | No | High (CLI install) |
| **Tailscale Serve** | Yes | **No** (passes `*.ts.net` Host) | Yes | High (requires tailnet on phone) |
| **mkcert** | Yes | **No** (still cross-origin IP) | No | Painful (iOS Root CA profile dance) |

Existing tunneling tools only solve the *network pipe*. They don't solve the *framework security guard*.

---

## How devhop Works

devhop combines two things in one command:

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

1. **Header Masquerading**: Intercepts incoming requests and rewrites `Host`, `Origin`, and `Referer` to `localhost:<port>`. Next.js and Vite believe the mobile phone is a local browser tab on your laptop, bypassing all cross-origin security guards.
2. **Ephemeral Cloudflare Quick Tunnel**: Creates an instant, trusted HTTPS tunnel without needing a Cloudflare account, credit card, or custom domain. iOS Safari sees a trusted Let's Encrypt certificate and grants camera/mic permissions without warnings.

---

## Quickstart

Run directly via `npx`:

```bash
# Auto-detects active dev server (Next.js, Vite, Astro, etc.)
npx devhop

# Or specify your port explicitly
npx devhop 3000

# Or install globally
npm install -g devhop
devhop 3000
```

### Options

```text
npx devhop                 Auto-detect active dev server port
npx devhop <port>          Expose port with terminal QR code
npx devhop <port> --no-qr  Expose port without printing QR code
npx devhop --help          Show help message
npx devhop --version       Show version
```

---

## Features

- ⚡ **Zero Config & Zero Signup**: No accounts, no API tokens, no credit cards.
- 🔄 **Working HMR / Fast Refresh**: Save code on your laptop and watch your mobile screen update instantly.
- 🎙️ **Full Web APIs Enabled**: Test Speech-to-Text (`getUserMedia`), camera capture, WebCrypto, and WebShare.
- 📱 **Instant QR Code**: Point your phone camera at the terminal to open the live URL.
- 🧹 **Zero Leftover Daemons**: Clean teardown on `Ctrl+C`. No orphaned processes or persistent background services.
- 💻 **Cross-Platform**: Works out of the box on macOS, Linux, and Windows.

---

## License
MIT © [Noor Latif](https://github.com/noor-latif) · [Fullstacked](https://fullstacked.se)
