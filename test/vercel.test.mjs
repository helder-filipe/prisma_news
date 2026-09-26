import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/news.js';

test('função Vercel serve a API RSS através do Worker partilhado', async () => {
  const originalFetch = globalThis.fetch;
  const date = new Date().toUTCString();
  globalThis.fetch = async () => new Response(`<rss version="2.0"><channel><title>Fonte</title><link>https://example.org</link><item><title>Município lança projeto de compostagem e recolha de resíduos</title><link>https://example.org/article</link><pubDate>${date}</pubDate></item></channel></rss>`);

  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; }
  };
  try {
    await handler({ method: 'GET', url: '/api/news?topic=biorresiduos&mode=noticias', headers: { host: 'prisma.test' } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.equal(JSON.parse(res.body).items.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
