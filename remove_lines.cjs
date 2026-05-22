const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf-8').split('\n');
// lines array is 0-indexed. lines 2527-2544 corresponds to index 2526-2543.
const kept = [...lines.slice(0, 2526), ...lines.slice(2544)];
fs.writeFileSync('index.html', kept.join('\n'));
console.log('Removed stray syntax error lines.');
