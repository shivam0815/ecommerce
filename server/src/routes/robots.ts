import express from "express";
const router = express.Router();

router.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(
`User-agent: *
Allow: /

Sitemap: https://nakodamobile.in/sitemap.xml`
  );
});

export default router;
