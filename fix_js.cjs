const fs = require('fs');

const raw = fs.readFileSync('index.html', 'utf-8');

// 1. Rewrite showDashboard
let fixed = raw.replace(
  /function showDashboard\(\) \{[\s\S]*?\}/,
  `function showDashboard() {
      document.getElementById('authPage').style.display = 'none';
      document.getElementById('dashboardPage').classList.add('active');
      document.getElementById('userEmail').textContent = currentUser.email;
      loadFinance();
      loadMeditation();
      setTimeout(renderCharts, 500); // ensure charts init when dashboard shown
    }`
);

// 2. Find and delete from // ===== TICKER ===== up to // ===== INIT =====
const tickerStart = fixed.indexOf('// ===== TICKER =====');
const initStart = fixed.indexOf('// ===== INIT =====');

if (tickerStart !== -1 && initStart !== -1) {
  fixed = fixed.substring(0, tickerStart) + fixed.substring(initStart);
}

// 3. Remove event listeners for missing elements in INIT block
fixed = fixed.replace(/document\.getElementById\('gmPushBtn'\)\.addEventListener[\s\S]*?\}\);/g, '');
fixed = fixed.replace(/makeAddHandlers\([\s\S]*?\);/g, '');

fs.writeFileSync('index.html', fixed);
console.log('Successfully stripped dead To-Do UI code and fixed showDashboard.');
