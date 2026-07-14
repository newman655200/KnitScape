import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const failures = [];

const indexHtml = read("index.html");
if (/kit\.fontawesome\.com/.test(indexHtml)) {
  failures.push("index.html must not load the external FontAwesome kit.");
}

const packageJson = JSON.parse(read("package.json"));
if (!packageJson.dependencies?.["@fortawesome/fontawesome-free"]) {
  failures.push("package.json must include local @fortawesome/fontawesome-free.");
}

const sourceIndex = read("src/index.js");
if (!sourceIndex.includes("@fortawesome/fontawesome-free/css/all.min.css")) {
  failures.push("src/index.js must import local FontAwesome CSS.");
}

const viteConfigPath = path.join(root, "vite.config.js");
if (!fs.existsSync(viteConfigPath)) {
  failures.push("vite.config.js must set a portable base path.");
} else {
  const viteConfig = fs.readFileSync(viteConfigPath, "utf8");
  if (!/base\s*:\s*["']\.\/["']/.test(viteConfig)) {
    failures.push('vite.config.js must set base: "./".');
  }
}

const distIndexPath = path.join(root, "dist", "index.html");
if (fs.existsSync(distIndexPath)) {
  const distIndex = fs.readFileSync(distIndexPath, "utf8");
  if (/kit\.fontawesome\.com/.test(distIndex)) {
    failures.push("dist/index.html must not load the external FontAwesome kit.");
  }
  if (/(?:src|href)="\/assets\//.test(distIndex)) {
    failures.push('dist/index.html must use relative "./assets/..." URLs.');
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("PASS: intranet build checks passed.");
