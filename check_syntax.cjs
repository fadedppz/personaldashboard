const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf-8');
const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);

if (scriptMatch) {
  fs.writeFileSync('temp_script.js', scriptMatch[1]);
  console.log('Script extracted. Running node -c...');
  require('child_process').exec('node -c temp_script.js', (err, stdout, stderr) => {
    if (err) console.error(stderr);
    else console.log('Syntax OK');
  });
} else {
  console.log('No module script found!');
}
