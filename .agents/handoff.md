# Session Handoff — 2026-09-11 08:35

## Completed Work
- [x] Conducted 4-vector deep research across competitor tunneling CLIs (`untun`, `tunnelmole`, `pinggy`, `zrok`, `bore`), mobile Secure Context specs, framework security defenses, and devtool virality (`research/DEEP_RESEARCH.md`).
- [x] Rewrote Next.js `x-action-redirect` response header in `createMasqueradeProxy` (`src/proxy.js:74-80`).
- [x] Prevented `cloudflared` auto-update child termination by passing `--no-autoupdate` in `startTunnel` (`src/tunnel.js:54`).
- [x] Hardened proxy against HTTP request smuggling on chunked transfers by forcing `Connection: close` (`src/proxy.js:52-55`).
- [x] Implemented `--json` output flag for AI coding agent orchestration (`src/cli.js:48,131`).
- [x] Expanded automated test suite to 10 tests covering Server Action redirects and chunked request smuggling (`test/proxy.test.js:299-382`).
- [x] Published `devhop` live to npm (`0.1.2` / `0.1.3`).
- [x] Verified end-to-end functionality against live Next.js 16 app (`ompweb` on port 30178) via public Cloudflare edge with successful `HTTP/2 200` response.
- [x] Updated README, dashboard, and skills with human-first developer vernacular (`2a8ac26`).

## Current State & Verification
- **Branch / Commit:** `main` at `2a8ac26`
- **Working Tree:** Clean (`git status -s` is empty)
- **Tests & Build:** 10/10 passing via `npm test` (`node --test`) in ~160ms.
- **npm Package:** Published under `devhop`.

## Immediate Next Steps (Actionable)
1. **Physical Mobile Device Smoke Test** — Run `npx devhop 30178` on laptop and scan QR code with physical iPhone/Android to test live speech dictation (`/api/stt`) in `ompweb`.
2. **Community Showcase / Launch Post** — Prepare an honest, unpretentious "Show HN" post following the playbook in `research/DEEP_RESEARCH.md`:
   * Title: `Show HN: devhop – Zero-config HTTPS tunnels for mobile testing with Secure Context & zero accounts`
   * Focus on real developer pain: Next.js `allowedDevOrigins` WebSocket drops and iOS Safari blocking `getUserMedia` on LAN IP.
3. **Optional Feature Watch** — Monitor user feedback for requests regarding:
   * Named subdomains via Cloudflare Tunnel credentials (`--domain <name>.latif.se`).
   * Custom target headers for non-standard local microservices.

## Known Traps & Gotchas
- **Next.js Server Actions**: Next.js 14–16 does not use standard `Location` headers during Server Action redirects; it emits `x-action-redirect`. Both must be rewritten.
- **Cloudflared Startup Exit**: Without `--no-autoupdate`, `cloudflared` checks for updates and self-terminates on launch, causing tunnels to fail on first run (as seen in `untun` and `nuxi dev --tunnel`).
- **Node.js undici / native fetch**: Native `fetch` throws `UND_ERR_INVALID_ARG` if `transfer-encoding: chunked` is passed manually in headers. Always use `http.request` to test chunked proxy behavior.
