
    // ===== SUPABASE FRONTEND CLIENT =====
    import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
    
    const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://udkdkqnnhhcyddmlbqas.supabase.co';
    const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVka2RrcW5uaGhjeWRkbWxicWFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjcyNzIsImV4cCI6MjA5NDY0MzI3Mn0.UqLPqOwBc8t-_Mu_9AsY7C4xecHRxcMM6yCyMCbOTAY';
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // ===== CONSTANTS =====
    const WAKE_HOUR = 8;
    const SLEEP_HOUR = 24;
    const ANTHROPIC_API_KEY = '';

    // ===== STATE =====
    let currentUser = null;
    let isSignUp = false;
    let tickerCycleIdx = 0;
    let tickerInterval = null;
    let dayRingInterval = null;
    let syncInterval = null;
    let pendingRemote = null;
    let lastSyncTime = 0;
    const SYNC_DEBOUNCE_MS = 300;
    const SYNC_POLL_MS = 5000;

    // ===== STORAGE HELPERS =====
    function storeGet(key) {
      try {
        return JSON.parse(localStorage.getItem(key));
      } catch {
        return null;
      }
    }

    function storeSet(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
      triggerCloudSync();
    }

    function storeDelete(key) {
      localStorage.removeItem(key);
      triggerCloudSync();
    }

    function storeListKeys(prefix) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(prefix)) keys.push(key);
      }
      return keys;
    }

    // ===== CLOUD SYNC =====
    let syncTimeout = null;

    function triggerCloudSync() {
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        pushToCloud();
      }, SYNC_DEBOUNCE_MS);
    }

    async function pushToCloud() {
      if (!currentUser) return;

      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const syncData = {};
      const allKeys = Object.keys(localStorage);

      for (const key of allKeys) {
        if (key.startsWith('goals:') || key === 'goal_streak_v1' || key === 'finance_v1' || key === 'meditation_v1') {
          syncData[key] = storeGet(key);
        }
      }

      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ data: syncData }),
        });

        if (!response.ok) {
          console.error('Sync push failed:', response.status);
          showSyncError();
        } else {
          showSyncSuccess();
        }
      } catch (error) {
        console.error('Sync push error:', error);
        showSyncError();
      }
    }

    async function pullFromCloud() {
      if (!currentUser) return;

      const token = localStorage.getItem('auth_token');
      if (!token) return;

      try {
        const response = await fetch('/api/sync', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) return;

        const { data } = await response.json();
        if (!data) return;

        // Check if user is actively editing
        const activeElement = document.activeElement;
        const isEditing = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.contentEditable === 'true'
        );

        if (isEditing) {
          pendingRemote = data;
          return;
        }

        // Apply remote data
        let changed = false;
        for (const [key, value] of Object.entries(data)) {
          const local = storeGet(key);
          if (JSON.stringify(local) !== JSON.stringify(value)) {
            localStorage.setItem(key, JSON.stringify(value));
            changed = true;
          }
        }

        if (changed) {
          loadToday();
          loadTomorrow();
          renderStreak();
          updateDayRing();
          if (typeof loadFinance === 'function') loadFinance();
          if (typeof loadMeditation === 'function') loadMeditation();
        }
      } catch (error) {
        console.error('Sync pull error:', error);
      }
    }

    function showSyncSuccess() {
      const indicator = document.getElementById('syncIndicator');
      indicator.classList.remove('error');
      indicator.classList.add('active');
      clearTimeout(indicator.hideTimeout);
      indicator.hideTimeout = setTimeout(() => {
        indicator.classList.remove('active');
      }, 2000);
    }

    function showSyncError() {
      const indicator = document.getElementById('syncIndicator');
      indicator.classList.add('error');
      indicator.classList.add('active');
      document.getElementById('syncText').textContent = 'Sync failed';
    }

    // ===== DATE HELPERS =====
    function getActiveDateString() {
      const now = new Date();
      if (now.getHours() < 6) {
        now.setDate(now.getDate() - 1);
      }
      return now.toISOString().split('T')[0];
    }

    function getTomorrowDateString() {
      const now = new Date();
      let tomorrow = new Date(now);
      if (now.getHours() < 6) {
        // Active day is yesterday, so tomorrow is today
        return now.toISOString().split('T')[0];
      } else {
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
      }
    }

    function formatDate(dateStr) {
      const date = new Date(dateStr + 'T00:00:00');
      const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();
      return `${weekday}, ${month} ${day}`;
    }

    // ===== AUTH =====
    // Safe JSON parse: checks Content-Type and handles empty bodies gracefully
    async function safeParseJSON(response) {
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        throw new Error(text.slice(0, 200) || `Server returned ${response.status} (non-JSON)`);
      }
      try {
        return await response.json();
      } catch {
        throw new Error(`Server returned ${response.status} with unparseable response`);
      }
    }

    // Map raw Supabase errors to user-friendly messages
    function humanizeAuthError(raw) {
      const map = {
        'email rate limit exceeded': 'Too many attempts — please wait a minute and try again.',
        'Invalid login credentials': 'Incorrect email or password.',
        'User already registered': 'An account with this email already exists. Sign in instead.',
        'Password should be at least 6 characters': 'Password must be at least 6 characters.',
        'Unable to validate email address': 'Please enter a valid email address.',
      };
      for (const [key, val] of Object.entries(map)) {
        if ((raw || '').toLowerCase().includes(key.toLowerCase())) return val;
      }
      return raw;
    }

    async function signIn(email, password) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          showAuthError(humanizeAuthError(error.message) || 'Sign in failed');
          return;
        }
        currentUser = { email: data.user.email, id: data.user.id };
        showDashboard();
      } catch (error) {
        showAuthError('Network error: ' + error.message);
      }
    }

    async function signUp(email, password) {
      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          showAuthError(humanizeAuthError(error.message) || 'Sign up failed');
          return;
        }
        // If email confirmation is required, the session won't exist yet
        if (data.session) {
          currentUser = { email: data.user.email, id: data.user.id };
          showDashboard();
        } else {
          showAuthError('Account created! Please check your email to confirm, then sign in.');
        }
      } catch (error) {
        showAuthError('Network error: ' + error.message);
      }
    }

    async function logout() {
      await supabase.auth.signOut();
      currentUser = null;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_email');
      showAuthPage();
    }

    function showAuthError(message) {
      const errorEl = document.getElementById('authError');
      errorEl.textContent = message;
      errorEl.style.display = 'block';
      document.getElementById('authSubmit').classList.remove('auth-loading');
    }

    function showAuthPage() {
      document.getElementById('authPage').style.display = 'flex';
      document.getElementById('dashboardPage').classList.remove('active');
      isSignUp = false;
      updateAuthUI();
    }

    function showDashboard() {
      document.getElementById('authPage').style.display = 'none';
      document.getElementById('dashboardPage').classList.add('active');
      document.getElementById('userEmail').textContent = currentUser.email;
      loadFinance();
      loadMeditation();
      setTimeout(renderCharts, 500); // ensure charts init when dashboard shown
    }

    function updateAuthUI() {
      const subtitle = document.getElementById('authSubtitle');
      const submit = document.getElementById('authSubmit');
      const toggleText = document.getElementById('authToggleText');
      const toggleBtn = document.getElementById('authToggleBtn');

      if (isSignUp) {
        subtitle.textContent = 'Create a new account';
        submit.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account? ';
        toggleBtn.textContent = 'Sign in';
      } else {
        subtitle.textContent = 'Sign in to your account';
        submit.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account? ";
        toggleBtn.textContent = 'Sign up';
      }
    }

    // ===== INIT =====
    let authSubmitting = false;

    document.getElementById('authForm').addEventListener('submit', (e) => {
      e.preventDefault();

      // Double-submit guard
      if (authSubmitting) return;
      authSubmitting = true;

      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const submitBtn = document.getElementById('authSubmit');

      // Basic client-side validation
      if (!email.includes('@') || !email.includes('.')) {
        showAuthError('Please enter a valid email address.');
        authSubmitting = false;
        return;
      }
      if (password.length < 6) {
        showAuthError('Password must be at least 6 characters.');
        authSubmitting = false;
        return;
      }

      submitBtn.classList.add('auth-loading');
      submitBtn.disabled = true;

      const done = () => { authSubmitting = false; submitBtn.disabled = false; };

      if (isSignUp) {
        signUp(email, password).finally(done);
      } else {
        signIn(email, password).finally(done);
      }
    });

    // Hide error when user starts typing
    document.getElementById('authEmail').addEventListener('input', () => {
      document.getElementById('authError').style.display = 'none';
    });
    document.getElementById('authPassword').addEventListener('input', () => {
      document.getElementById('authError').style.display = 'none';
    });

    document.getElementById('authToggleBtn').addEventListener('click', (e) => {
      e.preventDefault();
      isSignUp = !isSignUp;
      updateAuthUI();
      document.getElementById('authError').style.display = 'none';
      document.getElementById('authForm').reset();
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);

    // ===== NAV TABS INTERACTION =====
    function initTabs() {
      const tabBtns = document.querySelectorAll('.dash-tab-btn');
      const panels = document.querySelectorAll('.tab-panel');
      
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const targetTab = btn.getAttribute('data-tab');
          
          tabBtns.forEach(b => b.classList.remove('active'));
          panels.forEach(p => p.classList.remove('active'));
          
          btn.classList.add('active');
          document.getElementById(`${targetTab}Panel`).classList.add('active');
        });
      });
    }

    // ===== MEDITATION & BREATHING =====
    let meditationInterval = null;
    let meditationTimeLeft = 300; // 5 mins in seconds
    let isMeditationRunning = false;
    let breathingInterval = null;
    let breathingCycleSeconds = 0; // tracks 0 to 9 for the 10s cycle

    function initMeditation() {
      const presets = document.querySelectorAll('.preset-btn');
      const timerDisplay = document.getElementById('meditationTimer');
      const playBtn = document.getElementById('meditationPlayBtn');
      const resetBtn = document.getElementById('meditationResetBtn');
      
      presets.forEach(btn => {
        btn.addEventListener('click', () => {
          if (isMeditationRunning) return;
          presets.forEach(p => p.classList.remove('active'));
          btn.classList.add('active');
          const mins = parseInt(btn.getAttribute('data-mins'));
          meditationTimeLeft = mins * 60;
          updateMeditationTimerDisplay();
        });
      });

      playBtn.addEventListener('click', () => {
        if (isMeditationRunning) {
          pauseMeditation();
        } else {
          startMeditation();
        }
      });

      resetBtn.addEventListener('click', () => {
        resetMeditation();
      });

      // Guided Lessons list items
      const lessonItems = document.querySelectorAll('.lesson-item');
      const audio = document.getElementById('meditationAudio');
      const playerContainer = document.getElementById('audioPlayerContainer');
      const playerTitle = document.getElementById('playerTrackTitle');
      const playerTime = document.getElementById('playerTrackTime');
      const progressFill = document.getElementById('playerProgressFill');
      const progressBar = document.getElementById('playerProgressBar');

      lessonItems.forEach(item => {
        item.addEventListener('click', () => {
          const src = item.getAttribute('data-src');
          const title = item.getAttribute('data-title');
          
          lessonItems.forEach(li => li.classList.remove('playing'));
          item.classList.add('playing');
          
          audio.src = src;
          playerTitle.textContent = title;
          playerContainer.style.display = 'block';
          
          audio.play();
          
          // If focus timer is not running, we could start breathing helper too
          if (!isMeditationRunning) {
            startBreathingAnimation();
          }
        });
      });

      audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const current = formatAudioTime(audio.currentTime);
        const total = formatAudioTime(audio.duration);
        playerTime.textContent = `${current} / ${total}`;
        
        const percent = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = `${percent}%`;
      });

      progressBar.addEventListener('click', (e) => {
        if (!audio.duration) return;
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = clickX / rect.width;
        audio.currentTime = percent * audio.duration;
      });
    }

    function formatAudioTime(secs) {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    }

    function updateMeditationTimerDisplay() {
      const m = Math.floor(meditationTimeLeft / 60).toString().padStart(2, '0');
      const s = (meditationTimeLeft % 60).toString().padStart(2, '0');
      document.getElementById('meditationTimer').textContent = `${m}:${s}`;
    }

    function startMeditation() {
      isMeditationRunning = true;
      document.getElementById('meditationPlayBtn').innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
      
      meditationInterval = setInterval(() => {
        if (meditationTimeLeft > 0) {
          meditationTimeLeft--;
          updateMeditationTimerDisplay();
        } else {
          // Timer finished
          pauseMeditation();
          saveMeditationSession();
        }
      }, 1000);

      startBreathingAnimation();
    }

    function pauseMeditation() {
      isMeditationRunning = false;
      document.getElementById('meditationPlayBtn').innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
      clearInterval(meditationInterval);
      stopBreathingAnimation();
    }

    function resetMeditation() {
      pauseMeditation();
      const activePreset = document.querySelector('.preset-btn.active');
      const mins = activePreset ? parseInt(activePreset.getAttribute('data-mins')) : 5;
      meditationTimeLeft = mins * 60;
      updateMeditationTimerDisplay();
    }

    function startBreathingAnimation() {
      if (breathingInterval) clearInterval(breathingInterval);
      
      const circle = document.getElementById('breathingCircle');
      const text = document.getElementById('breathingText');
      
      // Reset breathing cycle
      breathingCycleSeconds = 0;
      updateBreathingUI(circle, text);
      
      breathingInterval = setInterval(() => {
        breathingCycleSeconds = (breathingCycleSeconds + 1) % 10;
        updateBreathingUI(circle, text);
      }, 1000);
    }

    function stopBreathingAnimation() {
      clearInterval(breathingInterval);
      breathingInterval = null;
      const circle = document.getElementById('breathingCircle');
      const text = document.getElementById('breathingText');
      circle.style.transform = 'scale(1.0)';
      text.textContent = 'Focus';
    }

    function updateBreathingUI(circle, text) {
      // 10s box breathing: Inhale 4s (0-3), Hold 1s (4), Exhale 4s (5-8), Hold 1s (9)
      if (breathingCycleSeconds >= 0 && breathingCycleSeconds < 4) {
        // Inhale phase: scale from 0.85 to 1.15
        const step = breathingCycleSeconds; // 0, 1, 2, 3
        const scale = 0.85 + (step / 3) * 0.3;
        circle.style.transform = `scale(${scale})`;
        text.textContent = 'Breathe In';
      } else if (breathingCycleSeconds === 4) {
        // Hold phase
        circle.style.transform = 'scale(1.15)';
        text.textContent = 'Hold';
      } else if (breathingCycleSeconds >= 5 && breathingCycleSeconds < 9) {
        // Exhale phase: scale from 1.15 down to 0.85
        const step = breathingCycleSeconds - 5; // 0, 1, 2, 3
        const scale = 1.15 - (step / 3) * 0.3;
        circle.style.transform = `scale(${scale})`;
        text.textContent = 'Breathe Out';
      } else if (breathingCycleSeconds === 9) {
        // Hold phase
        circle.style.transform = 'scale(0.85)';
        text.textContent = 'Hold';
      }
    }

    function saveMeditationSession() {
      const history = storeGet('meditation_v1') || [];
      const session = {
        date: new Date().toISOString(),
        durationMins: document.querySelector('.preset-btn.active') ? parseInt(document.querySelector('.preset-btn.active').getAttribute('data-mins')) : 5
      };
      history.push(session);
      storeSet('meditation_v1', history);
      triggerCloudSync();
    }

    function loadMeditation() {
      // Stub for any meditation stats update
    }

    // ===== FINANCE TRACKER =====
    function initFinance() {
      const toggleExpense = document.getElementById('toggleExpense');
      const toggleIncome = document.getElementById('toggleIncome');
      const categoryGroup = document.getElementById('financeCategoryGroup');
      const financeForm = document.getElementById('financeForm');
      const budgetLimitInput = document.getElementById('budgetLimitInput');
      const budgetLimitSaveBtn = document.getElementById('budgetLimitSaveBtn');
      const filterType = document.getElementById('filterType');
      const filterCategory = document.getElementById('filterCategory');

      let transactionType = 'expense'; // 'expense' or 'income'

      toggleExpense.addEventListener('click', (e) => {
        e.preventDefault();
        transactionType = 'expense';
        toggleExpense.classList.add('active');
        toggleIncome.classList.remove('active');
        categoryGroup.style.display = 'block';
      });

      toggleIncome.addEventListener('click', (e) => {
        e.preventDefault();
        transactionType = 'income';
        toggleIncome.classList.add('active');
        toggleExpense.classList.remove('active');
        categoryGroup.style.display = 'none';
      });

      financeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const desc = document.getElementById('financeDesc').value.trim();
        const amount = parseFloat(document.getElementById('financeAmount').value);
        const category = transactionType === 'income' ? 'income' : document.getElementById('financeCategory').value;

        if (!desc || isNaN(amount) || amount <= 0) return;

        const state = storeGet('finance_v1') || { transactions: [], budgetLimit: 500 };
        const entry = {
          id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          date: new Date().toISOString(),
          type: transactionType,
          description: desc,
          amount: amount,
          category: category
        };

        state.transactions.push(entry);
        storeSet('finance_v1', state);
        
        financeForm.reset();
        loadFinance();
        triggerCloudSync();
      });

      budgetLimitSaveBtn.addEventListener('click', () => {
        const limit = parseFloat(budgetLimitInput.value);
        if (isNaN(limit) || limit <= 0) return;

        const state = storeGet('finance_v1') || { transactions: [], budgetLimit: 500 };
        state.budgetLimit = limit;
        storeSet('finance_v1', state);
        
        budgetLimitInput.value = '';
        loadFinance();
        triggerCloudSync();
      });

      filterType.addEventListener('change', loadFinance);
      filterCategory.addEventListener('change', loadFinance);
    }

    function loadFinance() {
      const state = storeGet('finance_v1') || { transactions: [], budgetLimit: 500 };
      const txs = state.transactions || [];
      const budgetLimit = state.budgetLimit || 500;

      // Update budget text display
      document.getElementById('budgetValue').textContent = `$${budgetLimit.toFixed(2)}`;

      // Filter transactions
      const fType = document.getElementById('filterType').value;
      const fCategory = document.getElementById('filterCategory').value;

      let filtered = txs;
      if (fType !== 'all') {
        filtered = filtered.filter(t => t.type === fType);
      }
      if (fCategory !== 'all') {
        filtered = filtered.filter(t => t.category === fCategory);
      }

      // Sort by date descending
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Calculate totals for current month
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
      let totalIncome = 0;
      let totalExpenses = 0;

      txs.forEach(t => {
        const tDate = new Date(t.date);
        if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
          if (t.type === 'income') {
            totalIncome += t.amount;
          } else {
            totalExpenses += t.amount;
          }
        }
      });

      const netBalance = totalIncome - totalExpenses;

      document.getElementById('financeTotalIncome').textContent = `$${totalIncome.toFixed(2)}`;
      document.getElementById('financeTotalExpenses').textContent = `$${totalExpenses.toFixed(2)}`;
      
      const netEl = document.getElementById('financeNetBalance');
      netEl.textContent = `${netBalance >= 0 ? '' : '-'}$${Math.abs(netBalance).toFixed(2)}`;
      netEl.className = 'finance-card-value ' + (netBalance >= 0 ? 'income' : 'expense');

      // Update Budget Progress Bar and warning colors
      const usagePercent = Math.min((totalExpenses / budgetLimit) * 100, 100);
      const fillBar = document.getElementById('budgetProgressBarFill');
      fillBar.style.width = `${usagePercent}%`;
      document.getElementById('budgetPercent').textContent = `${Math.round((totalExpenses / budgetLimit) * 100)}% used`;

      // Premium budget warning system
      const percent = (totalExpenses / budgetLimit) * 100;
      if (percent >= 100) {
        fillBar.style.background = 'var(--danger)'; // Over budget
      } else if (percent >= 80) {
        fillBar.style.background = 'var(--warning)'; // Nearing limit
      } else {
        fillBar.style.background = 'var(--success)'; // Well within budget
      }

      // Render transactions list
      const listEl = document.getElementById('transactionsList');
      const emptyEl = document.getElementById('financeEmptyState');
      
      listEl.innerHTML = '';
      if (filtered.length === 0) {
        emptyEl.style.display = 'block';
      } else {
        emptyEl.style.display = 'none';
        filtered.forEach(tx => {
          const item = document.createElement('div');
          item.className = 'transaction-item';

          const details = document.createElement('div');
          details.className = 'transaction-details';

          const desc = document.createElement('span');
          desc.className = 'transaction-desc';
          desc.textContent = tx.description;

          // Emojis for categories
          const categoryEmojis = {
            food: '🥑',
            rent: '🏠',
            transport: '🚗',
            entertainment: '🎬',
            utilities: '💡',
            other: '📦',
            income: '💵'
          };
          const emoji = categoryEmojis[tx.category] || '💰';

          const badge = document.createElement('span');
          badge.className = `category-badge badge-${tx.category || 'other'}`;
          badge.textContent = `${emoji} ${(tx.category || tx.type).toUpperCase()}`;

          details.appendChild(desc);
          details.appendChild(badge);

          const right = document.createElement('div');
          right.style.display = 'flex';
          right.style.alignItems = 'center';
          right.style.gap = '12px';

          const amt = document.createElement('span');
          amt.className = `transaction-amount ${tx.type}`;
          amt.textContent = `${tx.type === 'income' ? '+' : '-'}$${tx.amount.toFixed(2)}`;

          const delBtn = document.createElement('button');
          delBtn.className = 'transaction-delete-btn';
          delBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          `;
          delBtn.addEventListener('click', () => {
            if (confirm(`Remove transaction "${tx.description}"?`)) {
              deleteTransaction(tx.id);
            }
          });

          right.appendChild(amt);
          right.appendChild(delBtn);

          item.appendChild(details);
          item.appendChild(right);
          listEl.appendChild(item);
        });
      }
    }

    function deleteTransaction(id) {
      const state = storeGet('finance_v1') || { transactions: [], budgetLimit: 500 };
      state.transactions = (state.transactions || []).filter(t => t.id !== id);
      storeSet('finance_v1', state);
      loadFinance();
      triggerCloudSync();
    }

    // ===== APP BOOT INITIALIZATION =====
    initTabs();
    initMeditation();
    initFinance();

    // Check if user is already logged in (Supabase persistent session)
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          currentUser = { email: session.user.email, id: session.user.id };
          showDashboard();
        } else {
          // Fallback: check old localStorage token for backward compat
          const token = localStorage.getItem('auth_token');
          if (token) {
            currentUser = { email: localStorage.getItem('user_email') };
            showDashboard();
          } else {
            showAuthPage();
          }
        }
      } catch (err) {
        console.warn('Session check failed:', err);
        showAuthPage();
      }
    })();

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
      audioEl.addEventListener('ended', () => {
        playerToggleIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
      });
    }

    // ===== NOTION BLOCK EDITOR =====
    const blocksContainer = document.getElementById('notionBlocksContainer');
    const slashMenu = document.getElementById('slashMenu');
    let activeBlock = null;
    let menuSelectedIndex = 0;
    
    function saveJournal() {
      const blocks = [];
      document.querySelectorAll('.notion-block').forEach(b => {
        blocks.push({ type: b.getAttribute('data-type') || 'p', content: b.innerHTML });
      });
      localStorage.setItem('journal_v1', JSON.stringify({
        title: document.getElementById('journalTitle').value, blocks
      }));
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
      
      block.addEventListener('input', () => {
        block.setAttribute('data-empty', block.textContent.trim() === '' ? 'true' : 'false');
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
          if (e.key === 'Enter') { e.preventDefault(); slashMenu.querySelectorAll('.slash-menu-item')[menuSelectedIndex].click(); }
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
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(prevBlock);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
          if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
        }
      });
      
      wrapper.addEventListener('dragstart', (e) => { wrapper.classList.add('dragging'); e.dataTransfer.setData('text/plain', ''); });
      wrapper.addEventListener('dragend', () => { wrapper.classList.remove('dragging'); saveJournal(); });
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
      const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      new Chart(ctxMain, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Activity Score', data: [65, 59, 80, 81, 56, 55, 90], borderColor: '#FAFAFA', backgroundColor: 'rgba(250, 250, 250, 0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      new Chart(ctxBar, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Income', data: [120, 0, 0, 450, 0, 0, 100], backgroundColor: '#10B981' }, { label: 'Expense', data: [45, 20, 60, 12, 100, 30, 80], backgroundColor: '#EF4444' }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
      new Chart(ctxLine, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Minutes', data: [10, 15, 0, 20, 10, 30, 15], borderColor: '#8B5CF6', tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
    setTimeout(renderCharts, 500);

  