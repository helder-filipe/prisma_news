import worker from '../dist/server/index.js';
import {getCache,waitUntil} from '@vercel/functions';
import {createResponseCache} from '../src/response-cache.js';

export default async function handler(req, res) {
  try {
    const requestUrl = new URL(req.url || '/api/news', `https://${req.headers.host || 'localhost'}`);
    const request = new Request(requestUrl, {
      method: req.method || 'GET',
      headers: { accept: req.headers.accept || 'application/json' }
    });
    const background=promise=>waitUntil(promise.catch(()=>{}));
    let storage;try{if(process.env.VERCEL)storage=getCache({namespace:'prisma-verde-v1'});}catch{}
    const cache=createResponseCache(storage);
    const response = await cache.respond(request, (imageCache,cachedNews)=>worker.fetch(request, {imageCache,cachedNews}, {waitUntil:background}), background);
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
