/* eslint-disable no-console */
/**
 * Simple SSG prerender for key routes (build-time).
 *
 * - Runs on Vercel automatically (process.env.VERCEL), or locally with SSG=1.
 * - Starts a tiny static server for /www (with SPA fallback to index.html).
 * - Uses Puppeteer to load routes, waits for the app data-ready event, then saves HTML to /www/<route>/index.html.
 *
 * Why this approach:
 * - AngularJS 1.x is not SSR-friendly; build-time prerender is the most practical SEO upgrade.
 * - Keeps runtime as a static site on Vercel (fast, cheap), while improving crawlability.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

async function main() {
  const shouldRun = process.env.VERCEL || process.env.SSG === '1';
  if (!shouldRun) {
    console.log('[prerender] skip (set SSG=1 to run locally, or runs automatically on Vercel)');
    return;
  }

  const puppeteer = require('puppeteer-core');

  const root = path.resolve(__dirname, '..');
  const outDir = path.join(root, 'www');
  const indexPath = path.join(outDir, 'index.html');

  if (!fs.existsSync(outDir) || !fs.existsSync(indexPath)) {
    throw new Error(`[prerender] missing www output. Expected ${indexPath}`);
  }

  // Cache original index.html for SPA fallback while we overwrite route outputs.
  const fallbackIndexHtml = fs.readFileSync(indexPath);

  const routes = [
    '/',
    '/about',
    '/items',
    '/buildings',
    '/blueprints',
    '/corporations',
    '/privacy-policy',
    '/terms-of-service'
  ];

  const { server, port } = await startStaticServer(outDir, fallbackIndexHtml);
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`[prerender] server started: ${baseUrl}`);

  const launchOptions = await getLaunchOptions();
  const browser = await puppeteer.launch(launchOptions);

  try {
    for (const route of routes) {
      const url = `${baseUrl}${route}`;
      console.log(`[prerender] rendering ${url}`);

      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

      // Install a listener before any scripts run, so we never miss the event.
      await page.evaluateOnNewDocument(() => {
        window.__ST_PRERENDER_READY__ = new Promise((resolve) => {
          document.addEventListener('st:data-ready', () => resolve(true), { once: true });
        });
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

      // Wait until the app reports data ready.
      await page.evaluate(() => window.__ST_PRERENDER_READY__, { timeout: 120000 });

      // Wait until ui-view is actually rendered (avoids capturing the "Loading data..." UI).
      await page.waitForFunction(
        () => {
          const view = document.querySelector('[ui-view]');
          return !!(view && view.children && view.children.length > 0);
        },
        { timeout: 120000 }
      );
      // Give Angular a tiny bit of time to settle any last DOM updates.
      await page.waitForTimeout(250);

      let html = await page.content();

      // Make canonical/og:url deterministic per route (helps SEO on SSG pages).
      html = patchCanonicalAndOgUrl(html, route);

      const outPath = routeToOutPath(outDir, route);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html);

      await page.close();
      console.log(`[prerender] wrote ${path.relative(root, outPath)}`);
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('[prerender] done');
}

function routeToOutPath(outDir, route) {
  if (route === '/' || route === '') {
    return path.join(outDir, 'index.html');
  }
  const clean = route.replace(/^\//, '');
  return path.join(outDir, clean, 'index.html');
}

function patchCanonicalAndOgUrl(html, route) {
  const base = 'https://starrupturecalculator.com';
  const url = route === '/' ? `${base}/` : `${base}${route}`;

  // <link rel="canonical" href="...">
  html = html.replace(
    /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
    `<link rel="canonical" href="${url}">`
  );

  // <meta property="og:url" content="...">
  html = html.replace(
    /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:url" content="${url}">`
  );

  return html;
}

function startStaticServer(outDir, fallbackIndexHtml) {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf'
  };

  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const safePath = urlPath.replace(/\0/g, '');

      // Map request to filesystem path.
      let filePath = path.join(outDir, safePath);

      // Directory -> index.html
      if (safePath.endsWith('/')) {
        filePath = path.join(outDir, safePath, 'index.html');
      } else if (!path.extname(safePath)) {
        // cleanUrls: /about -> /about/index.html (if exists)
        const asDirIndex = path.join(outDir, safePath, 'index.html');
        const asHtml = path.join(outDir, `${safePath}.html`);
        if (fs.existsSync(asDirIndex)) {
          filePath = asDirIndex;
        } else if (fs.existsSync(asHtml)) {
          filePath = asHtml;
        }
      }

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        // SPA fallback
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(fallbackIndexHtml);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
      res.end(fs.readFileSync(filePath));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`prerender server error: ${e && e.message ? e.message : String(e)}`);
    }
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

main().catch((e) => {
  console.error('[prerender] failed:', e);
  process.exit(1);
});

async function getLaunchOptions() {
  // Vercel runs on Linux, where Chromium sandbox is typically unavailable.
  // Use @sparticuz/chromium to avoid Puppeteer downloading a browser at install time (which often times out on CI/Vercel).
  if (process.env.VERCEL || process.platform === 'linux') {
    const chromium = require('@sparticuz/chromium');
    return {
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    };
  }

  // Local fallback (mac/windows): user must have Chrome installed.
  // You can override with PUPPETEER_EXECUTABLE_PATH.
  const override = process.env.PUPPETEER_EXECUTABLE_PATH;
  const executablePath = override || findLocalChrome();
  if (!executablePath) {
    throw new Error(
      '[prerender] No local Chrome found. Set PUPPETEER_EXECUTABLE_PATH=/path/to/Chrome to run prerender locally.'
    );
  }
  return {
    headless: 'new',
    executablePath,
    args: []
  };
}

function findLocalChrome() {
  const candidates = [];
  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  } else if (process.platform === 'win32') {
    const pf = process.env['PROGRAMFILES'] || 'C:\\\\Program Files';
    const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\\\Program Files (x86)';
    candidates.push(
      `${pf}\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe`,
      `${pf86}\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe`
    );
  }
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {
      // ignore
    }
  }
  return null;
}


