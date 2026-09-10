import qrcode from 'qrcode-terminal';
import pc from 'picocolors';
import { createMasqueradeProxy } from './proxy.js';
import { detectDevPorts, findFreePort } from './port.js';
import { ensureBinary, startTunnel } from './tunnel.js';

const VERSION = '0.1.0';

export function printHelp() {
  console.log(`
${pc.bold(pc.cyan('📱 pocketdev'))} ${pc.dim(`v${VERSION}`)}
${pc.dim('Test local web apps on physical mobile devices with zero config.')}

${pc.bold('Usage:')}
  ${pc.green('npx pocketdev <port>')}       Expose dev server (e.g. npx pocketdev 3000)
  ${pc.green('npx pocketdev')}              Auto-detect active dev server port
  ${pc.green('npx pocketdev <port> --no-qr')} Expose without printing QR code
  ${pc.green('npx pocketdev --help')}        Show this help message
  ${pc.green('npx pocketdev --version')}     Show version

${pc.bold('Features:')}
  ${pc.green('✔')} ${pc.bold('Fast Refresh & HMR')}     Rewrites headers so Next.js & Vite never block cross-origin websockets
  ${pc.green('✔')} ${pc.bold('Secure Context (HTTPS)')}   Trusted TLS for mobile Safari/Chrome microphone & camera access
  ${pc.green('✔')} ${pc.bold('OAuth & Redirect Safe')}    Rewrites Location headers so redirects stay on mobile tunnel
  ${pc.green('✔')} ${pc.bold('Session Cookie Friendly')}  Strips Domain=localhost so mobile browsers store auth cookies
  ${pc.green('✔')} ${pc.bold('Zero Setup')}              No account, no signups, no root CA certs, no system daemons
`);
}

export async function run(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`v${VERSION}`);
    return;
  }

  const showQr = !args.includes('--no-qr');
  let targetPort = null;

  const portArg = args.find((a) => !a.startsWith('-') && /^\d+$/.test(a));
  if (portArg) {
    targetPort = parseInt(portArg, 10);
  } else {
    // Port auto-detection
    console.log(`\n${pc.cyan('●')} Scanning for active dev servers...`);
    const active = await detectDevPorts();
    if (active.length === 1) {
      targetPort = active[0];
      console.log(`${pc.green('✔')} Auto-detected dev server running on port ${pc.bold(targetPort)}`);
    } else if (active.length > 1) {
      targetPort = active[0];
      console.log(
        `${pc.yellow('!')} Found multiple active ports (${active.join(', ')}). Using ${pc.bold(targetPort)}.`
      );
      console.log(`${pc.dim('  Tip: Specify explicitly with: npx pocketdev <port>')}`);
    } else {
      console.error(pc.red('\nNo active dev server detected on standard ports (3000, 5173, 8080, 4321, 30178).'));
      console.error(`Please specify your dev server port explicitly:\n  ${pc.cyan('npx pocketdev <port>')}\n`);
      process.exit(1);
    }
  }

  console.log(`\n${pc.cyan('●')} Initializing ${pc.bold('pocketdev')} for port ${pc.bold(targetPort)}...`);

  // Ensure cloudflared binary exists
  const binPath = await ensureBinary((msg) => {
    console.log(`${pc.dim('  ' + msg)}`);
  });

  // Pick an ephemeral local proxy port
  const proxyPort = await findFreePort();

  let publicUrl = null;

  // Create reverse proxy with header masquerade & response rewriting
  const { server, proxy } = createMasqueradeProxy({
    targetPort,
    getPublicUrl: () => publicUrl
  });

  await new Promise((resolve) => server.listen(proxyPort, '127.0.0.1', resolve));

  console.log(`${pc.dim('  Local masquerade proxy ready on port ' + proxyPort)}`);
  console.log(`${pc.cyan('●')} Connecting secure tunnel to Cloudflare Edge...`);

  let cleanedUp = false;
  let tunnelHandle = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (tunnelHandle) tunnelHandle.close();
    try { server.close(); } catch (_) {}
    try { proxy.close(); } catch (_) {}
    console.log(`\n${pc.yellow('✔')} Tunnel disconnected. Cleaned up.\n`);
  };

  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('exit', cleanup);

  tunnelHandle = startTunnel({
    localPort: proxyPort,
    binPath,
    onUrl: (url) => {
      publicUrl = url;
      displayDashboard(url, targetPort, showQr);
    },
    onError: (err) => {
      console.error(pc.red(`\nFailed to start cloudflared: ${err.message}`));
      cleanup();
      process.exit(1);
    },
    onClose: (code) => {
      if (!cleanedUp && code !== 0) {
        console.error(pc.red(`\ncloudflared exited with code ${code}`));
        cleanup();
        process.exit(code || 1);
      }
    }
  });
}

function displayDashboard(url, targetPort, showQr) {
  console.clear();
  console.log('');
  console.log(pc.bold(pc.bgCyan(pc.black(' 📱 POCKETDEV '))));
  console.log('');
  console.log(`  ${pc.bold('Target:')}       ${pc.green(`http://localhost:${targetPort}`)}`);
  console.log(`  ${pc.bold('Mobile URL:')}   ${pc.bold(pc.underline(pc.cyan(url)))}`);
  console.log('');
  console.log(`  ${pc.green('✔')} ${pc.dim('Host & Origin Masquerade active (Next.js / Vite HMR Safe)')}`);
  console.log(`  ${pc.green('✔')} ${pc.dim('Trusted HTTPS active (Microphone, Camera & WebCrypto Permitted)')}`);
  console.log(`  ${pc.green('✔')} ${pc.dim('Location & Cookie domain rewrites active')}`);
  console.log(`  ${pc.green('✔')} ${pc.dim('Zero configuration, no account required')}`);
  console.log('');

  if (showQr) {
    console.log(pc.dim('  Scan with your iPhone or Android camera:'));
    qrcode.generate(url, { small: true }, (qr) => {
      const indentedQr = qr.split('\n').map((line) => '  ' + line).join('\n');
      console.log(indentedQr);
    });
  }

  console.log(pc.dim('  Press ') + pc.bold('Ctrl+C') + pc.dim(' to stop the tunnel and disconnect.'));
  console.log('');
}
