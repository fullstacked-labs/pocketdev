# DevHop Skill for AI Coding Agents

Use this skill when a user wants to:
1. **Test local web apps on physical mobile devices** (iPhone Safari, Android Chrome).
2. **Test browser hardware Web APIs** that require a trusted HTTPS Secure Context:
   - Microphone / Speech-to-Text (`navigator.mediaDevices.getUserMedia`)
   - Camera capture
   - WebCrypto (`crypto.subtle`)
   - WebShare and PWA installation
3. **Overcome framework cross-origin dev server blocking**:
   - Next.js 14–16 `allowedDevOrigins` WebSocket / HMR rejection
   - Next.js Server Action CSRF origin mismatches
   - Vite `Invalid Host header`
4. **Test apps running in Docker / WSL2**:
   - Apps bound to `0.0.0.0` or running inside containers

## Commands
```bash
# Auto-detect active dev server port (Next.js, Vite, Astro, Nuxt, etc.)
npx devhop

# Specify port explicitly
npx devhop 3000

# Tolerant target inputs (agents can pass full terminal output URLs or hosts)
npx devhop http://localhost:5173
npx devhop localhost:3000
npx devhop 0.0.0.0:4321
npx devhop [::1]:3000

# Run without printing terminal QR code (useful for headless / CI / raw logs)
npx devhop --no-qr
```

## How It Works
1. **Ephemeral Cloudflare Quick Tunnel**: Creates an instant, trusted HTTPS tunnel (`https://*.trycloudflare.com`) with zero account or token setup.
2. **In-Process Header Masquerade**: Reverse proxy automatically rewrites `Host`, `Origin`, and `Referer` to `localhost:<port>`, making the upstream framework believe requests originate from a local browser tab on loopback.
3. **Secure Context Activation**: Grants mobile Safari and Chrome full access to `getUserMedia`, camera, and crypto without installing custom root CA certificates or provisioning `mkcert`.
4. **Unbuffered Streaming**: Disables buffering on Server-Sent Events (SSE) and AI token streams (`X-Accel-Buffering: no` and TCP `noDelay`).
5. **Dev Server Reboot Resilience**: Recovers cleanly from `ECONNREFUSED` with `502 Bad Gateway` and `Retry-After: 1` during framework restarts without dropping the tunnel.

## Instructions for AI Agents
- When the user asks to preview their app on a phone or test microphone/camera: invoke `npx devhop` (or pass the port/URL if known).
- Parse the output for the public `https://*.trycloudflare.com` URL and QR code, then present them clearly to the user.
- Explicitly tell the user that microphone, camera, and speech dictation work immediately because trusted HTTPS is active.
- To shut down: send `SIGINT` (Ctrl+C). DevHop guarantees clean child process termination with zero orphan process leaks.
