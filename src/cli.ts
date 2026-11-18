// Command-line check:  npm run check -- "Starbucks"
import { loadEngine } from './node';
import { band } from './engine';

const input = process.argv.slice(2).join(' ');
if (!input) {
  console.log('Usage: npm run check -- "Your Name Here"');
  process.exit(0);
}
const engine = loadEngine();
const r = engine.check(input, 'th');
console.log(`\n"${r.input}" as said by ${r.language} speakers\n`);
for (const [profile, o] of Object.entries(r.overall)) {
  console.log(`${profile.toUpperCase()}:  ${o.respelling}   ${o.script}`);
  console.log(`  Ease ${o.ease} (${band(o.ease)})   Survival ${o.survival} (${band(o.survival)})`);
  for (const w of r.words) {
    for (const c of w.profiles[profile].changes) {
      console.log(`   - [${w.word}] ${c.from} -> ${c.to || 'silent'} (${c.where}; ${c.confidence}) ${c.why}`);
    }
  }
  console.log('');
}
for (const w of r.words) console.log(`English sounds for "${w.word}" (${w.soundsFrom}): ${w.englishSounds.join(' ')}`);
for (const n of r.notes) console.log('Note: ' + n);
