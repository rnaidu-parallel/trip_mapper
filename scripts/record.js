// Headless frame-by-frame recording with Puppeteer.
// Usage: npm run dev   (in one terminal)
//        npm run record (in another)
// Output: frames/*.png, then run ffmpeg to assemble.
//
// Requires system ffmpeg: `brew install ffmpeg` if missing.

import puppeteer from 'puppeteer';
import { mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const URL = process.env.URL || 'http://127.0.0.1:5173/';
const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = Number(process.env.FPS || 60);
const FRAMES_DIR = path.resolve('frames');
const OUT_DIR = path.resolve('out');
const OUT_FILE = path.join(OUT_DIR, `journey-${Date.now()}.mp4`);

async function ensureDir(p, clean) {
  if (clean && existsSync(p)) await rm(p, { recursive: true, force: true });
  await mkdir(p, { recursive: true });
}

async function main() {
  await ensureDir(FRAMES_DIR, true);
  await ensureDir(OUT_DIR, false);

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-web-security']
  });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('[page]', msg.text()));
  page.on('pageerror', (err) => console.error('[page error]', err.message));

  console.log(`Loading ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.addStyleTag({ content: 'body { background: #000; } body { overflow: hidden; }' });

  // Wait until the page exposes __renderFrame and map is ready (after OSRM fetch + map load)
  await page.waitForFunction(
    () => window.__renderFrame && window.__totalDuration && window.__map && window.__map.loaded() && window.__timeline,
    { timeout: 120000, polling: 500 }
  );
  await page.evaluate(() => document.body.classList.add('recording'));

  const duration = await page.evaluate(() => window.__totalDuration());
  const totalFrames = Math.ceil((duration / 1000) * FPS);
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s → ${totalFrames} frames at ${FPS}fps`);

  const tStart = Date.now();
  for (let i = 0; i < totalFrames; i++) {
    const t = (i / FPS) * 1000;
    await page.evaluate((ms) => window.__renderFrame(ms), t);
    const filename = path.join(FRAMES_DIR, `frame_${String(i).padStart(5, '0')}.png`);
    await page.screenshot({ path: filename, type: 'png', omitBackground: false });
    if (i > 0 && i % 60 === 0) {
      const elapsed = (Date.now() - tStart) / 1000;
      const perFrame = elapsed / i;
      const eta = Math.round(perFrame * (totalFrames - i));
      const pct = ((i / totalFrames) * 100).toFixed(1);
      console.log(`  ${i}/${totalFrames} (${pct}%) | ${perFrame.toFixed(2)}s/frame | ETA ${Math.floor(eta / 60)}m ${eta % 60}s`);
    }
  }

  await browser.close();
  console.log('Frames done. Encoding with ffmpeg...');

  await new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y',
      '-framerate', String(FPS),
      '-i', path.join(FRAMES_DIR, 'frame_%05d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', '17',
      '-preset', 'slow',
      '-movflags', '+faststart',
      OUT_FILE
    ], { stdio: 'inherit' });
    ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))));
    ff.on('error', reject);
  });

  console.log(`\n✓ Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
