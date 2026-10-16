import { Router } from 'express';

// Express 4 does not forward rejected handler promises to error middleware.
export function asyncRouter() {
  const router = Router();
  for (const method of ['get', 'post', 'put', 'patch', 'delete', 'use']) {
    const register = router[method].bind(router);
    const wrap = (handler) => Array.isArray(handler) ? handler.map(wrap)
      : typeof handler !== 'function' || handler.length === 4 ? handler
      : (req, res, next) => Promise.resolve().then(() => handler(req, res, next)).catch(next);
    router[method] = (...args) => register(...args.map(wrap));
  }
  return router;
}
