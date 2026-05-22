const fs = require('fs');

const raw = fs.readFileSync('index.html', 'utf-8');

// Find the start of the CSS block and discard the corrupted CSS at the top
const authTitleIdx = raw.indexOf('.auth-title {');

const validCssStart = `  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --text-primary: #FAFAFA;
      --text-secondary: #A1A1AA;
      --text-tertiary: #52525B;
      --card-bg: #121212;
      --card-border: #27272A;
      --card-border-hover: #3F3F46;
      --accent: #E4E4E7;
      --danger: #EF4444;
      --warning: #F2C063;
      --success: #10B981;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0A0A0A;
      color: var(--text-primary);
      line-height: 1.5;
      overflow-x: hidden;
    }

    /* ===== AUTH PAGE ===== */
    #authPage {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }

    .auth-container {
      width: 100%;
      max-width: 400px;
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(24px) saturate(1.2);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    }

    `;

const finalHTML = raw.substring(0, raw.indexOf('<style>')) + validCssStart + raw.substring(authTitleIdx);

fs.writeFileSync('index.html', finalHTML);
console.log('Fixed CSS corruption at the top of the file.');
