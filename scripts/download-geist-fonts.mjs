import { access, mkdir } from "fs/promises";
import { createWriteStream } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fontDir = join(root, "public", "fonts");

const files = [
  [
    "Geist-Variable.woff2",
    "https://raw.githubusercontent.com/vercel/geist-font/main/packages/next/dist/fonts/geist-sans/Geist-Variable.woff2",
  ],
  [
    "GeistMono-Variable.woff2",
    "https://raw.githubusercontent.com/vercel/geist-font/main/packages/next/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  ],
];

await mkdir(fontDir, { recursive: true });

for (const [filename, url] of files) {
  const dest = join(fontDir, filename);
  try {
    await access(dest);
    continue;
  } catch {
    /* download */
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status}`);
  }
  await pipeline(res.body, createWriteStream(dest));
  console.log(`Downloaded ${filename}`);
}
