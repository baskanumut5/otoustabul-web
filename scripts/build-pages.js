const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const publicEntries = ["index.html", "ads.txt", "_headers", "assets", "css", "js"];

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const entry of publicEntries) {
  const source = path.join(rootDir, entry);
  if (!fs.existsSync(source)) continue;

  const destination = path.join(distDir, entry);
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.cpSync(source, destination, { recursive: true });
  } else {
    fs.copyFileSync(source, destination);
  }
}
