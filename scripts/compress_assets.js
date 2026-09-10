/* Compress mini-program static assets to fit the Alipay main-package limit.
   Strategy:
   - Resize oversized images down to realistic display sizes (guides ~900px wide,
     avatars/globe ~512px, large icons capped).
   - Re-encode JPEG with quality 80 (mozjpeg), PNG with level 9 + effort 10
     (lossless colors; keep alpha).
   - Dry-run mode: only report before/after sizes without writing.
   Usage: node compress_assets.js [--apply]
*/
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', 'apps', 'miniapp', 'src', 'static');
const APPLY = process.argv.includes('--apply');

// Realistic max dimensions (longest side). Guides render at full width (~750rpx
// logical, ~750px @2x), so width cap 900 keeps text crisp while slashing size.
const RULES = [
  { dir: 'guide', max: 900 },
  { dir: 'icons', overrides: {
      'hero-avatar.png': 512, 'default-avatar.png': 512,
      'hero-globe.jpg': 640, 'hero-logo.png': 512,
      'flag-eu.png': 512,
    }, max: 2000 },
];

function findRule(filePath) {
  const rel = path.relative(ROOT, filePath);
  const dir = rel.split(path.sep)[0];
  return RULES.find((r) => r.dir === dir) || { max: 2000 };
}

async function processImage(file, report) {
  let meta;
  try { meta = await sharp(file).metadata(); }
  catch (e) { console.log('SKIP (unreadable):', path.relative(ROOT, file), e.message); return; }

  const rule = findRule(file);
  const override = rule.overrides && rule.overrides[path.basename(file)];
  const max = override || rule.max;
  if (override === undefined && (meta.width <= 1080 && meta.height <= 1080) && meta.width <= max) {
    // Small enough; only touch when it exceeds the cap. Keep tiny icons untouched
    // to avoid needless rewrites of already-optimized sprites.
    return;
  }

  let buf = await sharp(file).toBuffer();

  if (meta.width > max || meta.height > max) {
    const scale = max / Math.max(meta.width, meta.height);
    buf = await sharp(file).resize({ width: Math.round(meta.width * scale), height: Math.round(meta.height * scale), fit: 'inside' }).toBuffer();
  }

  const isJpeg = /\.jpe?g$/i.test(file);
  const out = isJpeg
    ? await sharp(buf).jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:4:4' }).toBuffer()
    : await sharp(buf).png({ compressionLevel: 9, effort: 10 }).toBuffer();

  const before = fs.statSync(file).size;
  const after = out.length;
  report.push({ file, before, after });

  if (APPLY) {
    try {
      // On Windows, sometimes it fails to overwrite locked files; retry with rename+unlink
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, out);
      fs.unlinkSync(file);
      fs.renameSync(tmp, file);
    } catch (e) {
      console.error(`WARN: failed to write ${path.relative(ROOT, file)}: ${e.message}`);
    }
  }
}

(async () => {
  const files = [];
  (function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, ent.name);
      if (ent.isDirectory()) walk(fp);
      else if (/\.(png|jpe?g)$/i.test(ent.name)) files.push(fp);
    }
  })(ROOT);

  const report = [];
  for (const f of files) await processImage(f, report);

  const totBefore = report.reduce((s, r) => s + r.before, 0);
  const totAfter = report.reduce((s, r) => s + r.after, 0);
  console.log(`\n=== ${APPLY ? 'APPLIED' : 'DRY-RUN'} ===`);
  console.log(`Files touched: ${report.length}`);
  console.log(`Total: ${(totBefore / 1048576).toFixed(2)} MB -> ${(totAfter / 1048576).toFixed(2)} MB (saved ${(((totBefore - totAfter) / totBefore) * 100).toFixed(1)}%)`);
  console.log('\nTop reductions:');
  report.sort((a, b) => (b.before - b.after) - (a.before - a.after)).slice(0, 20)
    .forEach((r) => {
      console.log(`  ${(r.before / 1024).toFixed(0)}KB -> ${(r.after / 1024).toFixed(0)}KB  ${path.relative(ROOT, r.file)}`);
    });
})();