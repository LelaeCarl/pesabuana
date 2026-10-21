const { execFileSync } = require('fs');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const packages = [
  ['sql.js', 'latest'],
  ['react', 'latest'],
  ['react-dom', 'latest'],
  ['vite', 'latest'],
  ['@vitejs/plugin-react', 'latest'],
  ['electron', '33.4.11'],
  ['electron-builder', 'latest'],
];

const vendor = path.join(__dirname, '..', 'vendor');
fs.mkdirSync(vendor, { recursive: true });

function curl(url, output, resume) {
  const attempts = 30;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const args = [
      '--http1.1',
      '--connect-timeout', '15',
      '-fL',
      '--speed-limit', '1000',
      '--speed-time', '15',
      '--max-time', '90',
    ];
    if (resume) args.push('-C', '-');
    args.push('-o', output, url);
    const result = spawnSync('curl', args, { stdio: 'inherit' });
    if (result.status === 0) return;
    console.log(`Attempt ${attempt} stopped (${result.status}). Continuing.`);
  }
  throw new Error(`Download failed: ${url}`);
}

for (const [name, spec] of packages) {
  const safe = name.replace('/', '-') + '-' + spec;
  const metaPath = path.join(vendor, `${safe}.json`);
  const metaUrl = `https://registry.npmjs.org/${name}/${spec}`;
  let meta = null;
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (error) {
      meta = null;
    }
  }
  if (!meta || !meta.dist || !meta.dist.tarball) {
    console.log(`\nMetadata ${metaUrl}`);
    curl(metaUrl, metaPath, false);
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  }
  const tarball = meta.dist && meta.dist.tarball;
  if (!tarball) throw new Error(`No tarball for ${name}`);
  const fileName = path.basename(new URL(tarball).pathname);
  const tarballPath = path.join(vendor, fileName);
  const marker = `${tarballPath}.ok`;
  console.log(`Tarball ${tarball}`);
  if (!fs.existsSync(marker)) {
    curl(tarball, tarballPath, true);
    fs.writeFileSync(marker, 'ok');
  } else {
    console.log(`Already downloaded ${fileName}`);
  }
  console.log(`Ready ${meta.version} -> ${fileName}`);
}
