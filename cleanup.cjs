const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf-8').split('\n');

// Keep lines 1-11 (indices 0-10) which is head through <style>
// Skip lines 12-220 (indices 11-219) which is orphaned JS + dangling </script> + duplicate <style>
// Keep lines 221+ (indices 220+) which is the real CSS starting with * {
const kept = [...lines.slice(0, 11), ...lines.slice(220)];

fs.writeFileSync('index.html', kept.join('\n'));
console.log(`Removed ${lines.length - kept.length} orphaned lines. File now has ${kept.length} lines.`);
