# 📱 PocketDev — Product Requirements Document (PRD)

**Status**: Draft / In Review  
**Author**: Noor Latif  
**Target Launch**: Q3 2026  
**Repository**: [github.com/noor-latif/pocketdev](https://github.com/noor-latif/pocketdev)  
**Package**: `pocketdev` (npm)

---

## 1. Executive Summary & The "Villain"

### The Problem
Testing web applications on physical mobile devices (iPhone/Android) during local development is fundamentally broken in modern web frameworks (Next.js 14–16, Vite, Remix, Astro).

Developers encounter two hard blockers:
1. **The Framework HMR Wall**: Modern frameworks reject cross-origin WebSocket upgrades and dev chunk loading when accessed from non-localhost IPs or external domains (`Blocked cross-origin request to Next.js dev resource`).
2. **The Mobile Secure Context Wall**: Mobile Safari and Chrome hard-disable `navigator.mediaDevices.getUserMedia` (Microphone and Camera), `crypto.subtle`, and WebShare over plain LAN HTTP (`http://192.168.x.x:3000`).

### The Villain
Existing tunneling tools (`ngrok`, `cloudflared`, `localtunnel`) only solve the *network pipe*. They forward external Host headers (`xxx.ngrok-free.app`, `xxx.trycloudflare.com`), causing the framework security guards to kill Hot Module Reloading (HMR). Meanwhile, tools like `mkcert` require an excruciating root certificate installation dance on mobile devices.

### The Solution: PocketDev
A zero-config, single-command CLI (`npx pocketdev 3000`) that combines:
1. **An In-Process Header Masquerade**: Rewrites `Host`, `Origin`, and `Referer` to `localhost:<port>`, making the framework believe the phone is a local desktop browser tab.
2. **An Ephemeral Public HTTPS Tunnel**: Powered by Cloudflare Edge Quick Tunnels, granting a genuine Let's Encrypt certificate recognized as a Secure Context by mobile Safari with zero signups or accounts.
3. **An ASCII Terminal QR Code**: Zero typing on the phone.

---

## 2. Target User & Core Persona

* **Primary**: Fullstack & Frontend Web Developers building responsive, mobile-first web applications, PWAs, or voice/video AI apps (Speech-to-Text, camera capture, WebRTC).
* **Frameworks**: Next.js (App Router / Turbopack), Vite (React, Vue, Svelte), Remix, Astro.
* **Environments**: macOS (Apple Silicon & Intel), Linux (x64 & ARM64), Windows (x64).

---

## 3. User Journey & The Golden Path

```
Developer runs:
$ npx pocketdev 3000

Terminal output (< 3 seconds):
┌────────────────────────────────────────────────────────┐
│  📱 POCKETDEV v0.1.0                                   │
│                                                        │
│  Target:       http://localhost:3000                   │
│  Mobile URL:   https://breeze-sunset.trycloudflare.com │
│                                                        │
│  ✔ Next.js & Vite HMR Enabled (Masquerading)           │
│  ✔ Safari & Chrome Secure Context (Mic/Camera Active)  │
│  ✔ Zero Config & No Accounts                           │
│                                                        │
│  Scan with your iPhone or Android camera:              │
│  [ ASCII QR CODE ]                                     │
│                                                        │
│  Press Ctrl+C to disconnect.                           │
└────────────────────────────────────────────────────────┘

1. Developer points iPhone camera at terminal -> taps banner.
2. App opens in Mobile Safari over HTTPS.
3. Developer edits code in VS Code -> Phone updates instantly via HMR.
4. Developer taps mic/camera button -> Safari prompts permission -> works.
5. Developer presses Ctrl+C -> Proxy and tunnel terminate cleanly.
```

---

## 4. Functional Requirements

### V1 — The Viral MVP (Current Scope)
- [x] **Zero-Daemon Architecture**: Runs entirely in user-space. No background services, no systemd, no sudo.
- [x] **Header Masquerading**: Rewrites `Host`, `Origin`, and `Referer` on all HTTP requests and WebSocket (`upgrade`) handshakes.
- [x] **Ephemeral Cloudflare Quick Tunnel**: Auto-downloads and executes `cloudflared` into user cache; extracts `trycloudflare.com` URL.
- [x] **Terminal QR Code**: Renders high-contrast, compact ASCII QR code.
- [x] **Clean Teardown**: Intercepts `SIGINT` / `SIGTERM` / `exit` and kills child processes without leaking sockets.
- [ ] **Response Redirect Rewriting**: Intercepts `Location: http://localhost:<port>` headers in 301/302/307 redirects and rewrites them to the public tunnel URL.
- [ ] **Cookie Domain Stripping**: Strips or rewrites `Domain=localhost` in incoming `Set-Cookie` headers so mobile browsers accept auth cookies.
- [ ] **Protocol Header Forwarding**: Sets `x-forwarded-proto: https` and `x-forwarded-ssl: on`.
- [ ] **Port Auto-Detection**: If no port is passed (`npx pocketdev`), probes ports `3000`, `5173`, `8080`, `30178` and auto-selects if only one is active.

### V2 — Post-Launch Expansion
- [ ] **Custom Domains**: Support `--domain <name>.latif.se` via Cloudflare Named Tunnels or token authentication.
- [ ] **Private Tailnet Mode**: Support `--tailscale` for enterprise developers who cannot use public tunnels.
- [ ] **AI Agent Skills / MCP Server**: Export as a Claude Code / Cursor MCP tool (`/pocketdev`) allowing agents to test UI on mobile.
- [ ] **Mobile Console Inspector**: Optional `--inspect` flag that mirrors mobile Safari `console.log` messages into the desktop terminal.

---

## 5. Deliberate Non-Goals (What We Refuse to Build)

1. **No Accounts, No Authentication, No Database**: We will not require users to create an account, enter an email, or pass an API key for core functionality.
2. **No Permanent Production Hosting**: PocketDev is for *local development and immediate mobile testing*, not for hosting production sites. Tunnels are ephemeral.
3. **No Heavy Electron / GUI App**: PocketDev is a fast, terminal-native CLI. 
4. **No Telemetry / Tracking**: Zero phone-home tracking or analytics. Developers inspect the code and see pure privacy.

---

## 6. Edge Case Defense Matrix

| Edge Case | Failure Mode Without PocketDev | PocketDev Defense |
|---|---|---|
| **Server Action / OAuth Redirect** | Server returns `Location: http://localhost:3000/auth/callback` -> Phone screen blanks. | Proxy rewrites response `Location` headers back to public tunnel domain. |
| **Auth Session Cookies** | Server issues cookie with `Domain=localhost` -> Phone rejects cookie. | Proxy removes `Domain=localhost` attribute from `Set-Cookie` headers. |
| **HMR Reconnection on Sleep** | Phone locks screen -> TCP socket drops -> HMR halts. | Proxy keeps loopback alive; reconnects handshake upon phone unlock. |
| **First Run / Slow Connection** | User runs CLI without `cloudflared` on slow network. | CLI displays clean download progress bar; caches binary permanently in `~/.cache/pocketdev/bin`. |
| **Orphaned Processes** | Terminal window closed unexpectedly. | Parent process PID watch + `on('exit')` hooks ensure `cloudflared` is terminated. |

---

## 7. Metrics & Definition of Success

* **Time-to-Value**: Under **5 seconds** from typing `npx pocketdev 3000` to scanning the QR code on a phone.
* **Zero Drop-off Friction**: 0 logins, 0 config files edited, 0 certificate profiles installed.
* **GitHub Star Target**: 1,000+ stars within 14 days of Show HN.
* **npm Weekly Downloads**: 5,000+ weekly downloads within 60 days.
