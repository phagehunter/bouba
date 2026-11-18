// Makes the spreadsheet that Thai speakers fill in to confirm or correct the predictions.
// Usage: npx tsx scripts/make-check-sheet.ts
import { writeFileSync } from 'node:fs';
import { loadEngine } from '../src/node';

const NAMES = ['Shell', 'Starbucks', 'Apple', 'Google', 'Netflix', 'Line', 'Tesla', 'Microsoft', 'Sprite', 'Golf',
  'Facebook', 'Instagram', 'Twitter', 'Amazon', 'Central', 'Lotus', 'Visa', 'Zoom', 'Dell', 'Grab', 'Shopee', 'Lazada',
  'Burger King', 'Pizza Hut', 'Mastercard', 'Disney', 'Fresh', 'Smooth', 'Health', 'Bridge', 'Strive', 'Flux', 'Crisp',
  'Zyntrova', 'Velto'];
const engine = loadEngine();
const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
const rows = [[
  'Name', 'Predicted: most speakers', 'Predicted: younger speakers', 'Predicted Thai spelling',
  'Is "most speakers" right? (Y/N)', 'Is "younger speakers" right? (Y/N)',
  'How would you say it? (Thai letters are fine)', 'How would you spell it in Thai?', 'Comments',
].map(q).join(',')];
for (const name of NAMES) {
  const r = engine.check(name, 'th').overall;
  rows.push([name, r.traditional.respelling, r.younger.respelling, r.traditional.script, '', '', '', '', ''].map(q).join(','));
}
// The leading marker makes Excel and Numbers read the Thai letters correctly.
writeFileSync('2026-11-16-thai-native-check-sheet.csv', '﻿' + rows.join('\r\n') + '\r\n');
console.log('rows:', NAMES.length);
