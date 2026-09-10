import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { install } from 'cloudflared/lib/install.js';

export function getBinPath() {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'cloudflared.exe' : 'cloudflared';

  const cacheDir = process.env.XDG_CACHE_HOME
    ? path.join(process.env.XDG_CACHE_HOME, 'devhop', 'bin')
    : path.join(os.homedir(), '.cache', 'devhop', 'bin');

  return path.join(cacheDir, binName);
}

export async function ensureBinary(onProgress) {
  const binPath = getBinPath();

  // If binary exists and is valid (> 1MB), reuse it
  if (fs.existsSync(binPath)) {
    try {
      const stat = fs.statSync(binPath);
      if (stat.size > 1024 * 1024) {
        return binPath;
      }
      // If corrupted / 0-byte, remove and redownload
      fs.unlinkSync(binPath);
    } catch (_) {}
  }

  const dir = path.dirname(binPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Atomic download to .tmp file to prevent corrupt cache on interrupt
  const tempPath = `${binPath}.tmp-${Date.now()}`;
  if (onProgress) onProgress('Downloading cloudflared binary (one-time setup)...');

  try {
    await install(tempPath);
    fs.renameSync(tempPath, binPath);
    try { fs.chmodSync(binPath, '755'); } catch (_) {}
    return binPath;
  } catch (err) {
    try { fs.unlinkSync(tempPath); } catch (_) {}
    throw new Error(`Failed to install cloudflared: ${err.message}`);
  }
}

export function startTunnel({ localPort, binPath, onUrl, onError, onClose }) {
  const child = spawn(binPath, ['tunnel', '--url', `http://127.0.0.1:${localPort}`], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let urlFound = false;

  const handleOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !urlFound) {
      urlFound = true;
      if (onUrl) onUrl(match[0]);
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  if (onError) child.on('error', onError);
  if (onClose) child.on('close', onClose);

  return {
    child,
    close: () => {
      try {
        child.kill('SIGTERM');
        // SIGKILL fallback after 500ms to guarantee zero zombie processes
        setTimeout(() => {
          try {
            if (!child.killed) child.kill('SIGKILL');
          } catch (_) {}
        }, 500);
      } catch (_) {}
    }
  };
}
