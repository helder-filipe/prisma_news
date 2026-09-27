import worker from '../dist/server/index.js';

export default async function handler(req, res) {
  try {
    const requestUrl = new URL(req.url || '/api/news', `https://${req.headers.host || 'localhost'}`);
    const request = new Request(requestUrl, {
      method: req.method || 'GET',
      headers: { accept: req.headers.accept || 'application/json' }
    });
    const response = await worker.fetch(request, {}, { waitUntil: promise => promise.catch(() => {}) });
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(await response.text());
  } catch (error) {
    console.error('PRISMA API error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Não foi possível consultar as notícias.' }));
  }
}
