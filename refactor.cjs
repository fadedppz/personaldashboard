const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf-8');

// 1. Add Chart.js and update fonts in head
html = html.replace(
  '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">',
  `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=Lora:ital,wght@0,400;0,600;1,400&family=Space+Mono&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
);

// 2. Remove Vibecoded CSS
const bodyCssRegex = /body \{[\s\S]*?@keyframes drift \{[\s\S]*?\}/;
html = html.replace(bodyCssRegex, `body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0A0A0A;
      color: var(--text-primary);
      line-height: 1.5;
      overflow-x: hidden;
    }
    /* Minimalist sleek theme updates */
    :root {
      --text-primary: #FAFAFA;
      --text-secondary: #A1A1AA;
      --text-tertiary: #52525B;
      --card-bg: #121212;
      --card-border: #27272A;
      --card-border-hover: #3F3F46;
      --accent: #E4E4E7;
      --danger: #EF4444;
      --success: #10B981;
    }`);

// 3. Add Journal & Editor CSS before </style>
html = html.replace('</style>', `
    /* ===== JOURNAL BLOCK EDITOR ===== */
    .notion-editor {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    .notion-title-input {
      font-size: 40px;
      font-weight: 700;
      color: var(--text-primary);
      background: transparent;
      border: none;
      outline: none;
      width: 100%;
      margin-bottom: 24px;
      font-family: 'Outfit', sans-serif;
    }
    
    .notion-title-input::placeholder {
      color: #3f3f46;
    }

    .notion-block-container {
      position: relative;
      display: flex;
      align-items: flex-start;
      margin-bottom: 4px;
      transition: background 0.2s;
      border-radius: 4px;
    }
    
    .notion-block-container:hover {
      background: rgba(255, 255, 255, 0.02);
    }
    
    .notion-drag-handle {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      cursor: grab;
      opacity: 0;
      transition: opacity 0.2s;
      margin-top: 2px;
      user-select: none;
    }
    
    .notion-block-container:hover .notion-drag-handle {
      opacity: 1;
    }
    
    .notion-drag-handle:active {
      cursor: grabbing;
    }

    .notion-block {
      flex: 1;
      min-height: 24px;
      padding: 4px 8px;
      outline: none;
      color: var(--text-primary);
      font-size: 16px;
      line-height: 1.6;
    }
    
    .notion-block[data-empty="true"]:empty::before {
      content: attr(placeholder);
      color: #52525B;
      pointer-events: none;
    }
    
    /* Formatting Types */
    .notion-block.type-h1 { font-size: 30px; font-weight: 700; font-family: 'Outfit', sans-serif; margin-top: 16px; margin-bottom: 8px; }
    .notion-block.type-h2 { font-size: 24px; font-weight: 600; font-family: 'Outfit', sans-serif; margin-top: 12px; margin-bottom: 6px; }
    .notion-block.type-quote { border-left: 3px solid var(--text-primary); padding-left: 12px; font-style: italic; color: var(--text-secondary); font-family: 'Lora', serif; }
    
    /* Slash Menu */
    .slash-menu {
      position: absolute;
      background: #18181B;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      width: 240px;
      z-index: 100;
      padding: 8px;
      display: none;
    }
    
    .slash-menu.active { display: block; }
    
    .slash-menu-item {
      padding: 8px 12px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .slash-menu-item:hover, .slash-menu-item.selected {
      background: #27272A;
      color: var(--text-primary);
    }
    
    .slash-icon {
      width: 24px; height: 24px;
      background: #27272A;
      border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-primary);
    }
    
    /* Overview Analytics Grid */
    .analytics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    .analytics-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 20px;
    }
    @media (max-width: 800px) {
      .analytics-grid { grid-template-columns: 1fr; }
    }
</style>`);

// 4. Update Tabs HTML
html = html.replace(
  '<button class="dash-tab-btn" data-tab="meditation">',
  `<button class="dash-tab-btn" data-tab="journal">
      <svg class="tab-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
      Journal
    </button>
    <button class="dash-tab-btn" data-tab="meditation">`
);

// 5. Replace Overview Content and insert Journal Panel
const overviewContentRegex = /<!-- GOAL TICKER -->[\s\S]*?<!-- MEDITATION PANEL -->/;
html = html.replace(overviewContentRegex, `<!-- DASHBOARD ANALYTICS OVERVIEW -->
      <div class="analytics-grid">
        <div class="analytics-card" style="grid-column: 1 / -1;">
          <h2 class="section-title" style="margin-bottom: 8px;">Activity Overview</h2>
          <p class="section-subtitle" style="color: var(--text-secondary); margin-bottom: 24px;">Your combined performance across finance and meditation.</p>
          <div style="height: 300px; width: 100%;">
            <canvas id="mainActivityChart"></canvas>
          </div>
        </div>
        
        <div class="analytics-card">
          <h3 class="section-subtitle">Weekly Spend vs Income</h3>
          <div style="height: 200px; width: 100%; margin-top: 16px;">
            <canvas id="financeBarChart"></canvas>
          </div>
        </div>
        
        <div class="analytics-card">
          <h3 class="section-subtitle">Meditation Consistency</h3>
          <div style="height: 200px; width: 100%; margin-top: 16px;">
            <canvas id="meditationLineChart"></canvas>
          </div>
        </div>
      </div>
    </div> <!-- Close #overviewPanel -->

    <!-- JOURNAL PANEL -->
    <div id="journalPanel" class="tab-panel">
      <div class="notion-editor">
        <input type="text" class="notion-title-input" id="journalTitle" placeholder="Untitled Journal" />
        <div id="notionBlocksContainer">
          <!-- Blocks injected here -->
        </div>
        
        <!-- Slash Menu UI -->
        <div class="slash-menu" id="slashMenu">
          <div class="slash-menu-item selected" data-type="p">
            <div class="slash-icon">T</div>
            <div>
              <div style="font-weight:600; color: #fff;">Text</div>
              <div style="font-size:11px;">Just start typing with plain text.</div>
            </div>
          </div>
          <div class="slash-menu-item" data-type="h1">
            <div class="slash-icon">H1</div>
            <div>
              <div style="font-weight:600; color: #fff;">Heading 1</div>
              <div style="font-size:11px;">Big section heading.</div>
            </div>
          </div>
          <div class="slash-menu-item" data-type="h2">
            <div class="slash-icon">H2</div>
            <div>
              <div style="font-weight:600; color: #fff;">Heading 2</div>
              <div style="font-size:11px;">Medium section heading.</div>
            </div>
          </div>
          <div class="slash-menu-item" data-type="quote">
            <div class="slash-icon">"</div>
            <div>
              <div style="font-weight:600; color: #fff;">Quote</div>
              <div style="font-size:11px;">Capture a quote or idea.</div>
            </div>
          </div>
        </div>
      </div>
    </div> <!-- Close #journalPanel -->

    <!-- MEDITATION PANEL -->`);

// 6. Fix Audio Player Pause Button
html = html.replace(
  '<div class="player-track-info">',
  `<div class="player-controls" style="margin-bottom: 8px;">
                  <button id="playerToggleBtn" class="control-btn" style="width: 36px; height: 36px; background: var(--text-primary); color: #000; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <svg id="playerToggleIcon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  </button>
                </div>
                <div class="player-track-info">`
);

// 7. Supabase JS Client & Persistent Auth
// Replace the old auth module block entirely.
const jsAuthRegex = /<script type="module">[\s\S]*?\/\/ ===== CONSTANTS =====/;
html = html.replace(jsAuthRegex, `<script type="module">
    // ===== SUPABASE FRONTEND CLIENT =====
    import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
    
    const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://udkdkqnnhhcyddmlbqas.supabase.co';
    const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVka2RrcW5uaGhjeWRkbWxicWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjcyNzIsImV4cCI6MjA5NDY0MzI3Mn0.UqLPqOwBc8t-_Mu_9AsY7C4xecHRxcMM6yCyMCbOTAY';
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ===== CONSTANTS =====`);

// Replace sign-in logic
const signinLogicRegex = /authForm\.addEventListener\('submit', async \(e\) => \{[\s\S]*?\}\);/;
html = html.replace(signinLogicRegex, `authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('authEmail').value;
      const password = document.getElementById('authPassword').value;
      
      authSubmit.disabled = true;
      authSubmit.textContent = 'Please wait...';
      authError.style.display = 'none';

      try {
        if (isSignUp) {
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          currentUser = { email: session.user.email };
          showDashboard();
        } else {
          throw new Error('No session returned. Please check email to verify.');
        }
      } catch (err) {
        authError.textContent = err.message || 'Authentication failed';
        authError.style.display = 'block';
      } finally {
        authSubmit.disabled = false;
        authSubmit.textContent = isSignUp ? 'Sign Up' : 'Sign In';
      }
    });`);

// Replace boot initialization
const bootRegex = /const token = localStorage\.getItem\('auth_token'\);[\s\S]*?showAuthPage\(\);\n    \}/;
html = html.replace(bootRegex, `
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = { email: session.user.email };
      showDashboard();
    } else {
      showAuthPage();
    }

    // Also remove the manual auth_token clearing in logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await supabase.auth.signOut();
      location.reload();
    });`);

// Inject the Notion Editor and Analytics JS right before the end of the script tag
html = html.replace('</script>', `

    // ===== AUDIO PLAYER PAUSE FIX =====
    const playerToggleBtn = document.getElementById('playerToggleBtn');
    const playerToggleIcon = document.getElementById('playerToggleIcon');
    const audioEl = document.getElementById('meditationAudio');
    
    if (playerToggleBtn && audioEl) {
      playerToggleBtn.addEventListener('click', () => {
        if (audioEl.paused) {
          audioEl.play();
          playerToggleIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        } else {
          audioEl.pause();
          playerToggleIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
        }
      });
      
      // Update icon when track ends
      audioEl.addEventListener('ended', () => {
        playerToggleIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      });
    }

    // ===== NOTION BLOCK EDITOR =====
    const blocksContainer = document.getElementById('notionBlocksContainer');
    const slashMenu = document.getElementById('slashMenu');
    let activeBlock = null;
    let menuSelectedIndex = 0;
    
    // Save to local storage (sync later)
    function saveJournal() {
      const blocks = [];
      document.querySelectorAll('.notion-block').forEach(b => {
        blocks.push({
          type: b.getAttribute('data-type') || 'p',
          content: b.innerHTML
        });
      });
      localStorage.setItem('journal_v1', JSON.stringify({
        title: document.getElementById('journalTitle').value,
        blocks
      }));
      // trigger sync logic if you want
    }
    
    function createBlock(type = 'p', content = '') {
      const wrapper = document.createElement('div');
      wrapper.className = 'notion-block-container';
      wrapper.draggable = true;
      
      const handle = document.createElement('div');
      handle.className = 'notion-drag-handle';
      handle.innerHTML = '⋮⋮';
      
      const block = document.createElement('div');
      block.className = 'notion-block type-' + type;
      block.setAttribute('contenteditable', 'true');
      block.setAttribute('data-type', type);
      block.setAttribute('data-empty', content.trim() === '' ? 'true' : 'false');
      block.setAttribute('placeholder', type === 'p' ? "Type '/' for commands" : 'Heading');
      block.innerHTML = content;
      
      wrapper.appendChild(handle);
      wrapper.appendChild(block);
      
      // Events
      block.addEventListener('input', () => {
        block.setAttribute('data-empty', block.textContent.trim() === '' ? 'true' : 'false');
        
        // Show slash menu
        if (block.textContent.trim() === '/') {
          const rect = block.getBoundingClientRect();
          slashMenu.style.display = 'block';
          slashMenu.style.top = (rect.bottom + window.scrollY) + 'px';
          slashMenu.style.left = rect.left + 'px';
          activeBlock = block;
          menuSelectedIndex = 0;
          updateMenuSelection();
        } else {
          slashMenu.style.display = 'none';
        }
        saveJournal();
      });
      
      block.addEventListener('keydown', (e) => {
        if (slashMenu.style.display === 'block') {
          if (e.key === 'ArrowDown') { e.preventDefault(); menuSelectedIndex = Math.min(3, menuSelectedIndex + 1); updateMenuSelection(); }
          if (e.key === 'ArrowUp') { e.preventDefault(); menuSelectedIndex = Math.max(0, menuSelectedIndex - 1); updateMenuSelection(); }
          if (e.key === 'Enter') {
            e.preventDefault();
            const items = slashMenu.querySelectorAll('.slash-menu-item');
            items[menuSelectedIndex].click();
          }
          if (e.key === 'Escape') { slashMenu.style.display = 'none'; }
          return;
        }
        
        if (e.key === 'Enter') {
          e.preventDefault();
          const newBlock = createBlock('p', '');
          wrapper.after(newBlock);
          newBlock.querySelector('.notion-block').focus();
        }
        
        if (e.key === 'Backspace' && block.textContent === '') {
          e.preventDefault();
          const prev = wrapper.previousElementSibling;
          if (prev && prev.classList.contains('notion-block-container')) {
            wrapper.remove();
            const prevBlock = prev.querySelector('.notion-block');
            prevBlock.focus();
            // Move caret to end
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(prevBlock);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        
        // Allow formatting via keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
          if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
        }
      });
      
      // Drag & Drop events on wrapper
      wrapper.addEventListener('dragstart', (e) => {
        wrapper.classList.add('dragging');
        e.dataTransfer.setData('text/plain', ''); // Required for Firefox
      });
      wrapper.addEventListener('dragend', () => {
        wrapper.classList.remove('dragging');
        saveJournal();
      });
      wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (dragging && dragging !== wrapper) {
          const rect = wrapper.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (e.clientY < mid) wrapper.parentNode.insertBefore(dragging, wrapper);
          else wrapper.parentNode.insertBefore(dragging, wrapper.nextSibling);
        }
      });
      
      return wrapper;
    }
    
    function updateMenuSelection() {
      const items = slashMenu.querySelectorAll('.slash-menu-item');
      items.forEach((it, idx) => it.classList.toggle('selected', idx === menuSelectedIndex));
    }
    
    // Init Slash Menu clicks
    document.querySelectorAll('.slash-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        if (activeBlock) {
          const type = item.getAttribute('data-type');
          activeBlock.className = 'notion-block type-' + type;
          activeBlock.setAttribute('data-type', type);
          activeBlock.innerHTML = '';
          activeBlock.setAttribute('placeholder', type === 'quote' ? 'Empty quote' : 'Heading');
          slashMenu.style.display = 'none';
          activeBlock.focus();
          saveJournal();
        }
      });
    });
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.slash-menu') && !e.target.closest('.notion-block')) {
        slashMenu.style.display = 'none';
      }
    });
    
    // Load existing journal
    const savedJ = localStorage.getItem('journal_v1');
    if (savedJ) {
      const jData = JSON.parse(savedJ);
      document.getElementById('journalTitle').value = jData.title || '';
      if (jData.blocks && jData.blocks.length > 0) {
        jData.blocks.forEach(b => blocksContainer.appendChild(createBlock(b.type, b.content)));
      } else {
        blocksContainer.appendChild(createBlock('p', ''));
      }
    } else {
      blocksContainer.appendChild(createBlock('p', ''));
    }
    
    document.getElementById('journalTitle').addEventListener('input', saveJournal);

    // ===== CHART.JS DASHBOARD ANALYTICS =====
    function renderCharts() {
      if (!window.Chart) return;
      
      const ctxMain = document.getElementById('mainActivityChart')?.getContext('2d');
      const ctxBar = document.getElementById('financeBarChart')?.getContext('2d');
      const ctxLine = document.getElementById('meditationLineChart')?.getContext('2d');
      
      if(!ctxMain || !ctxBar || !ctxLine) return;
      
      Chart.defaults.color = '#A1A1AA';
      Chart.defaults.font.family = 'Inter';
      
      // Mock aggregated data for now (in a real app, this parses finance_v1/meditation_v1)
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      new Chart(ctxMain, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Activity Score',
            data: [65, 59, 80, 81, 56, 55, 90],
            borderColor: '#FAFAFA',
            backgroundColor: 'rgba(250, 250, 250, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      
      new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Income', data: [120, 0, 0, 450, 0, 0, 100], backgroundColor: '#10B981' },
            { label: 'Expense', data: [45, 20, 60, 12, 100, 30, 80], backgroundColor: '#EF4444' }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
      
      new Chart(ctxLine, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Minutes',
            data: [10, 15, 0, 20, 10, 30, 15],
            borderColor: '#8B5CF6',
            tension: 0.3
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
    
    // Render charts after a slight delay to ensure UI is ready
    setTimeout(renderCharts, 500);

</script>`);

fs.writeFileSync('index.html', html);
console.log('Successfully refactored index.html');
