// Hostinger Node.js entry point
// Set this as the "Application startup file" in Hostinger's Node.js panel.
const { createServer } = require("http");
const { parse } = require("url");
const path = require("path");
const fs = require("fs");

const dotNextPath = path.join(__dirname, ".next");
if (!fs.existsSync(dotNextPath)) {
  console.error("ERROR: .next directory not found. Run 'npm run build' first.");
  console.error("On Hostinger, set the build command to: npm run build");
  process.exit(1);
}

const next = require("next");

const port = parseInt(process.env.PORT, 10) || 3000;
const app = next({ dev: false, dir: __dirname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, "0.0.0.0", () => {
      console.log(`> StockPulse ready on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start StockPulse:", err);
    process.exit(1);
  });
