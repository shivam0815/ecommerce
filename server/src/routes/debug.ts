import { Router } from 'express';
const r = Router();

r.post('/_echo', (req, res) => {
  res.json({
    gotBody: req.body,               // what server sees
    headers: req.headers['content-type'],
  });
});

export default r;