import fs from 'node:fs';
import path from 'node:path';

const AUDIO_DIR = path.join(import.meta.dirname, 'audio');
const ROUNDS = ['2023_3', '2024_1', '2024_2', '2024_3', '2025_1', '2025_2'];

const roundLabel = (r) => {
  const [y, s] = r.split('_');
  return `${y}年度 第${s}回`;
};

function labelFromFile(file, kind) {
  // jun1kyu_2025_2_Listening_03_Part1_No1.mp3 -> "Part1 No1"
  const base = file.replace(/\.mp3$/, '');
  const m = base.match(new RegExp(`${kind}_\\d+_?(.*)$`));
  const rest = m ? m[1] : '';
  if (!rest) return kind === 'Listening' ? '指示・概要' : '指示・概要';
  return rest.replace(/_/g, ' ');
}

const data = {};

for (const r of ROUNDS) {
  const dir = path.join(AUDIO_DIR, r);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3')).sort();

  const listening = files
    .filter(f => f.includes('_Listening_'))
    .map(f => ({ file: `audio/${r}/${f}`, name: labelFromFile(f, 'Listening') }));

  const speaking = files
    .filter(f => f.includes('_Speaking_'))
    .map(f => ({ file: `audio/${r}/${f}`, name: labelFromFile(f, 'Speaking') }));

  data[r] = {
    label: roundLabel(r),
    sections: [
      { key: 'listening', label: 'Listening', tracks: listening },
      { key: 'speaking', label: 'Speaking', tracks: speaking },
    ],
  };
}

const out = path.join(import.meta.dirname, 'tracks.json');
fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n', 'utf8');

let total = 0;
for (const r of ROUNDS) {
  for (const s of data[r].sections) total += s.tracks.length;
}
console.log(`generated tracks.json: ${ROUNDS.length} rounds, ${total} tracks`);
