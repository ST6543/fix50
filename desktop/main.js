/**
 * FIX50 Desktop — Electron-hoesje rond de web-versie van de app.
 *
 * Serveert de meegepakte web-bundel (desktop/www) via een lokale HTTP-server
 * op 127.0.0.1 (geen file://-problemen met assets/cookies) en opent een
 * venster in telefoon-formaat. Alleen publishable Supabase-credentials zitten
 * in de bundel — de backend blijft exact dezelfde als in de mobiele app.
 *
 * Testmodus: FIX50_DESKTOP_TEST=1 → geen venster, logt de server-URL en
 * sluit zichzelf na enkele seconden af (voor geautomatiseerde checks).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const WWW = path.join(__dirname, 'www');
const TEST_MODE = process.env.FIX50_DESKTOP_TEST === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.normalize(path.join(WWW, urlPath));
    // Pad-escape tegenhouden: alles moet binnen www/ blijven.
    if (!filePath.startsWith(WWW)) {
      send(res, 403, 'Forbidden', MIME['.txt']);
      return;
    }
    let stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    if (stat && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    }
    if (!stat) {
      // SPA-fallback: onbekende routes → index.html.
      filePath = path.join(WWW, 'index.html');
      if (!fs.existsSync(filePath)) {
        send(res, 404, 'Bundel ontbreekt (desktop/www). Herbouw met: npm run desktop:export', MIME['.txt']);
        return;
      }
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, fs.readFileSync(filePath), MIME[ext] || 'application/octet-stream');
  } catch (err) {
    send(res, 500, `Serverfout: ${err && err.message}`, MIME['.txt']);
  }
});

// Vrije poort zoeken (alleen loopback — niet bereikbaar vanaf het netwerk).
const freePort = () =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });

async function main() {
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${port}`;
  console.log(`[desktop] FIX50 server gereed op ${url}`);

  if (TEST_MODE) {
    // Rooktest: HTTP-check door de aanroeper, daarna netjes stoppen.
    setTimeout(() => {
      console.log('[desktop] testmodus klaar — stop.');
      process.exit(0);
    }, 12_000);
    return;
  }

  const { app, BrowserWindow, shell } = require('electron');

  function createWindow() {
    const win = new BrowserWindow({
      width: 480,
      height: 920,
      minWidth: 380,
      minHeight: 640,
      backgroundColor: '#0B0D10',
      title: 'FIX50',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    // Popup van de PDF-export (blob-URL + printvenster) toestaan.
    win.webContents.setWindowOpenHandler(({ url: target }) => {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } };
    });
    win.webContents.on('willNavigate', (event, target) => {
      // Alleen externe http(s)-links (Supabase-docs e.d.) in de browser openen.
      if (/^https?:\/\//i.test(target) && !target.startsWith(url)) {
        event.preventDefault();
        shell.openExternal(target);
      }
    });
    win.loadURL(url);
  }

  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}

main().catch((err) => {
  console.error('[desktop] opstartfout:', err);
  process.exit(1);
});
