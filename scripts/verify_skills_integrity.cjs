const fs = require('fs');
const path = require('path');

const root = path.resolve('.');
const base = path.join(root, 'assets/.agent/skills');

console.log('=== Verifying Skills Architecture Integrity ===');

let totalErrors = 0;
let totalSkills = 0;
let topLevelCount = 0;

const topLevelItems = fs.readdirSync(base);
topLevelItems.forEach(item => {
  const p = path.join(base, item);
  if (fs.statSync(p).isDirectory()) {
    topLevelCount++;
    const skillMd = path.join(p, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      console.error(`[ERROR] Missing SKILL.md in top-level directory: ${item}`);
      totalErrors++;
    }
  }
});

console.log(`Discovered Top-Level Installed Suites / Skills: ${topLevelCount}`);

function checkDir(dir) {
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      const skillFile = path.join(fullPath, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        totalSkills++;
        const content = fs.readFileSync(skillFile, 'utf8');
        
        // Validate frontmatter
        if (!content.startsWith('---')) {
          console.error(`[ERROR] ${path.relative(base, skillFile)} is missing YAML frontmatter opening '---'`);
          totalErrors++;
        } else {
          const matchName = content.match(/^name:\s*(.+)$/m);
          const matchDesc = content.match(/^description:\s*(.+)$/m);
          if (!matchName) {
            console.error(`[ERROR] ${path.relative(base, skillFile)} is missing 'name:' in frontmatter`);
            totalErrors++;
          }
          if (!matchDesc) {
            console.error(`[ERROR] ${path.relative(base, skillFile)} is missing 'description:' in frontmatter`);
            totalErrors++;
          }
        }

        // Validate markdown relative links in SKILL.md
        const linkRegex = /\[.*?\]\((?!https?:\/\/)(?!file:\/\/)(?!#)(.*?)\)/g;
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
          const rawTarget = match[1].split('#')[0]; // strip anchor
          if (rawTarget) {
            const resolved = path.resolve(fullPath, rawTarget);
            if (!fs.existsSync(resolved)) {
              console.error(`[ERROR] Broken relative link in ${path.relative(base, skillFile)} -> ${rawTarget} (resolved: ${resolved})`);
              totalErrors++;
            }
          }
        }
      }
      checkDir(fullPath);
    }
  });
}

checkDir(base);

console.log(`Total SKILL.md files verified: ${totalSkills}`);
console.log(`Total Errors Detected: ${totalErrors}`);

if (totalErrors === 0) {
  console.log('✓ All skills, frontmatters, and relative links verified successfully!');
} else {
  process.exit(1);
}
