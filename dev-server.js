import { createServer } from 'http';
import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const PORT = 3000;
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Simple JSON body parser
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

// Route map: method + path -> handler file
const routes = {
  'POST /api/auth/signin': 'api/auth/signin.js',
  'POST /api/auth/signup': 'api/auth/signup.js',
  'GET /api/sync': 'api/sync.js',
  'POST /api/sync': 'api/sync.js',
};

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Strip query string for route matching
  const cleanUrl = req.url.split('?')[0];
  const key = `${req.method} ${cleanUrl}`;
  const handlerPath = routes[key];

  if (!handlerPath) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not found: ${key}` }));
    return;
  }

  try {
    // Cache-busting query param for dev (so handler edits take effect without restart)
    const modulePath = pathToFileURL(join(__dirname, handlerPath)).href + '?t=' + Date.now();
    const handler = (await import(modulePath)).default;
    const body = await parseBody(req);

    // Build Vercel-compatible request object
    const reqObj = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body,
    };

    // Build Vercel-compatible response object
    const resObj = {
      status(code) {
        this._statusCode = code;
        return this;
      },
      json(data) {
        res.writeHead(this._statusCode || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      },
    };

    await handler(reqObj, resObj);
  } catch (err) {
    console.error(`Handler error [${key}]:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', detail: err.message || String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`API dev server running on http://localhost:${PORT}`);
});
