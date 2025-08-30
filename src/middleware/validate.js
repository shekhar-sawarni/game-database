import { ZodError } from 'zod';

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body || {});
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: e.issues });
      }
      return res.status(400).json({ error: 'Invalid request' });
    }
  };
}


