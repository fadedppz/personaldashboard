
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
        const response = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await safeParseJSON(response);

        if (!response.ok) {
          showAuthError(humanizeAuthError(data.error) || 'Sign in failed');
          return;
        }

        currentUser = data.user;
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_email', email);

        showDashboard();
        // pullFromCloud is already called by showDashboard → startCloudSync
      } catch (error) {
        showAuthError('Network error: ' + error.message);
      }
    }

    async function signUp(email, password) {
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await safeParseJSON(response);

        if (!response.ok) {
          showAuthError(humanizeAuthError(data.error) || 'Sign up failed');
          return;
        }

        // Email confirmation required — don't log in yet
        if (!data.token) {
          showAuthError(data.message || 'Please check your email to confirm your account.');
          document.getElementById('authSubmit').classList.remove('auth-loading');
          return;
        }

        currentUser = data.user;
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_email', email);

        showDashboard();
      } catch (error) {
        showAuthError('Network error: ' + error.message);
      }
    }

    function logout() {
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
      loadToday();
      loadTomorrow();
      renderStreak();
      updateDayRing();
      startTicker();
      startDayRingUpdate();
      startCloudSync();
      loadFinance();
      loadMeditation();
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

    // ===== TICKER =====
    function buildTickerItems() {
      const todayKey = `goals:${getActiveDateString()}`;
      const goals = storeGet(todayKey) || [];
      const pending = goals.filter(g => !g.done);
      const total = goals.length;

      if (total === 0) {
        return [{ status: 'empty', text: 'No goals set for today — add one to get rolling.' }];
      }

      if (pending.length === 0) {
        return [{ status: 'done', text: '✓ All goals done — solid day.' }];
      }

      return pending.map(g => ({ status: 'pending', text: g.text }));
    }

    function tick() {
      const items = buildTickerItems();
      const stage = document.getElementById('goalTickerStage');
      const meta = document.getElementById('goalTickerMeta');
      const todayKey = `goals:${getActiveDateString()}`;
      const goals = storeGet(todayKey) || [];
      const done = goals.filter(g => g.done).length;
      const total = goals.length;

      meta.textContent = `${done}/${total}`;

      if (tickerCycleIdx >= items.length) tickerCycleIdx = 0;
      const item = items[tickerCycleIdx];

      const oldRow = stage.querySelector('.goal-ticker-row');
      if (oldRow) {
        oldRow.classList.add('is-leaving');
        setTimeout(() => oldRow.remove(), 460);
      }

      const newRow = document.createElement('div');
      newRow.className = 'goal-ticker-row is-entering';
      newRow.innerHTML = `
        <span class="goal-ticker-status" data-status="${item.status}">${
          item.status === 'done' ? '✓' : item.status === 'pending' ? '○' : '·'
        }</span>
        <span class="goal-ticker-text">${item.text}</span>
      `;
      stage.appendChild(newRow);

      tickerCycleIdx++;
    }

    function startTicker() {
      tick();
      if (tickerInterval) clearInterval(tickerInterval);
      tickerInterval = setInterval(tick, 5000);
    }

    window.addEventListener('goals-changed', () => {
      tickerCycleIdx = 0;
      tick();
    });

    // ===== DAY RING =====
    function interpolateColor(percent) {
      const stops = [
        { p: 0, c: [255, 216, 158] },
        { p: 12.5, c: [255, 205, 121] },
        { p: 25, c: [255, 227, 143] },
        { p: 37.5, c: [255, 183, 106] },
        { p: 50, c: [255, 149, 89] },
        { p: 62.5, c: [243, 111, 79] },
        { p: 75, c: [226, 93, 122] },
        { p: 87.5, c: [123, 91, 176] },
        { p: 100, c: [47, 58, 102] },
      ];

      let lower = stops[0];
      let upper = stops[stops.length - 1];

      for (let i = 0; i < stops.length - 1; i++) {
        if (stops[i].p <= percent && percent <= stops[i + 1].p) {
          lower = stops[i];
          upper = stops[i + 1];
          break;
        }
      }

      const range = upper.p - lower.p;
      const t = range === 0 ? 0 : (percent - lower.p) / range;

      const r = Math.round(lower.c[0] + (upper.c[0] - lower.c[0]) * t);
      const g = Math.round(lower.c[1] + (upper.c[1] - lower.c[1]) * t);
      const b = Math.round(lower.c[2] + (upper.c[2] - lower.c[2]) * t);

      return `rgb(${r}, ${g}, ${b})`;
    }

    function updateDayRing() {
      const now = new Date();
      const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

      const percentageEl = document.getElementById('dayRingPercentage');
      const phaseEl = document.getElementById('dayRingPhase');
      const statusEl = document.getElementById('dayRingStatus');
      const remainingEl = document.getElementById('dayRingRemaining');
      const clockEl = document.getElementById('dayRingClock');
      const fillEl = document.getElementById('dayRingFill');

      const hour12 = now.getHours() % 12 || 12;
      const minute = String(now.getMinutes()).padStart(2, '0');
      const ampm = now.getHours() < 12 ? 'AM' : 'PM';
      clockEl.textContent = `${hour12}:${minute} ${ampm}`;

      if (hours < WAKE_HOUR) {
        percentageEl.textContent = '—';
        phaseEl.textContent = 'SLEEPING';
        statusEl.textContent = '😴 Still sleeping';
        const hoursUntil = WAKE_HOUR - hours;
        const m = Math.floor((hoursUntil % 1) * 60);
        remainingEl.textContent = `${Math.floor(hoursUntil)}h ${m}m until wake-up`;
        fillEl.style.stroke = '#4D4B47';
        fillEl.style.strokeDashoffset = '326.73';
      } else if (hours < SLEEP_HOUR) {
        const percent = ((hours - WAKE_HOUR) / (SLEEP_HOUR - WAKE_HOUR)) * 100;
        percentageEl.textContent = Math.round(percent) + '%';

        let phase, status;
        if (percent < 25) {
          phase = 'MORNING';
          status = '☀️ Morning — fresh start';
        } else if (percent < 50) {
          phase = 'MIDDAY';
          status = '⚡ Midday — keep moving';
        } else if (percent < 75) {
          phase = 'AFTERNOON';
          status = '🔥 Afternoon — push it';
        } else if (percent < 90) {
          phase = 'EVENING';
          status = '⏳ Evening — wrap up';
        } else {
          phase = 'BEDTIME';
          status = '🌙 Bedtime soon';
        }

        phaseEl.textContent = phase;
        statusEl.textContent = status;

        const hoursLeft = SLEEP_HOUR - hours;
        const m = Math.floor((hoursLeft % 1) * 60);
        remainingEl.textContent = `${Math.floor(hoursLeft)}h ${m}m awake time left`;

        const color = interpolateColor(percent);
        fillEl.style.stroke = color;
        const circumference = 2 * Math.PI * 52;
        fillEl.style.strokeDashoffset = circumference * (1 - percent / 100);
      } else {
        percentageEl.textContent = '100%';
        phaseEl.textContent = 'PAST BEDTIME';
        statusEl.textContent = '⚠️ Past bedtime';
        remainingEl.textContent = 'Sleep!';
        fillEl.style.stroke = '#E25D7A';
        fillEl.style.strokeDashoffset = '0';
      }
    }

    function startDayRingUpdate() {
      updateDayRing();
      if (dayRingInterval) clearInterval(dayRingInterval);
      dayRingInterval = setInterval(updateDayRing, 60 * 1000);
    }

    // ===== GOAL LIST =====
    function buildGoalRow(goal, index, key, readOnly = false) {
      const li = document.createElement('li');
      li.className = 'goal-item';
      if (goal.done) li.classList.add('goal-done');
      if (goal.queued) li.classList.add('goal-queued');
      li.draggable = !readOnly;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'goal-checkbox';
      checkbox.checked = goal.done;
      checkbox.disabled = readOnly;

      checkbox.addEventListener('change', () => {
        const goals = storeGet(key) || [];
        goals[index].done = checkbox.checked;
        if (checkbox.checked) {
          goals[index].doneAt = Date.now();
        } else {
          delete goals[index].doneAt;
        }
        storeSet(key, goals);
        if (key === `goals:${getActiveDateString()}`) {
          loadToday();
        } else {
          loadTomorrow();
        }
        window.dispatchEvent(new CustomEvent('goals-changed'));
      });

      const dragHandle = document.createElement('div');
      dragHandle.className = 'goal-drag-handle';
      dragHandle.textContent = '⋮⋮';

      const text = document.createElement('div');
      text.className = 'goal-text';
      text.textContent = goal.text;

      text.addEventListener('click', () => {
        if (readOnly) return;
        makeInlineEdit(text, goal, index, key);
      });

      const queueBtn = document.createElement('button');
      queueBtn.className = 'goal-queue-btn';
      queueBtn.textContent = '⚡';
      if (goal.queued) queueBtn.classList.add('gm-queue-active');
      queueBtn.disabled = readOnly;

      queueBtn.addEventListener('click', () => {
        const goals = storeGet(key) || [];
        goals[index].queued = !goals[index].queued;
        storeSet(key, goals);
        queueBtn.classList.add('is-queue-flashing');
        setTimeout(() => {
          if (key === `goals:${getActiveDateString()}`) {
            loadToday();
          } else {
            loadTomorrow();
          }
          window.dispatchEvent(new CustomEvent('goals-changed'));
        }, 480);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'goal-delete';
      deleteBtn.textContent = '×';

      deleteBtn.addEventListener('click', () => {
        const goals = storeGet(key) || [];
        goals.splice(index, 1);
        storeSet(key, goals);
        if (key === `goals:${getActiveDateString()}`) {
          loadToday();
        } else {
          loadTomorrow();
        }
        window.dispatchEvent(new CustomEvent('goals-changed'));
      });

      li.appendChild(dragHandle);
      li.appendChild(checkbox);
      li.appendChild(text);
      li.appendChild(queueBtn);
      li.appendChild(deleteBtn);

      if (!readOnly) {
        li.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', index);
        });

        li.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          li.style.borderTop = '2px solid rgba(255,255,255,0.2)';
        });

        li.addEventListener('dragleave', () => {
          li.style.borderTop = '';
        });

        li.addEventListener('drop', (e) => {
          e.preventDefault();
          li.style.borderTop = '';
          const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
          const goals = storeGet(key) || [];
          const [moved] = goals.splice(fromIdx, 1);
          goals.splice(index, 0, moved);
          storeSet(key, goals);
          if (key === `goals:${getActiveDateString()}`) {
            loadToday();
          } else {
            loadTomorrow();
          }
        });
      }

      return li;
    }

    function makeInlineEdit(textEl, goal, index, key) {
      const original = textEl.textContent;
      textEl.contentEditable = 'true';
      textEl.focus();
      const range = document.createRange();
      range.selectNodeContents(textEl);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      function commit() {
        const newText = textEl.textContent.trim();
        textEl.contentEditable = 'false';

        if (newText && newText !== original) {
          const goals = storeGet(key) || [];
          goals[index].text = newText;
          storeSet(key, goals);
          if (key === `goals:${getActiveDateString()}`) {
            loadToday();
          } else {
            loadTomorrow();
          }
          window.dispatchEvent(new CustomEvent('goals-changed'));
        } else {
          textEl.textContent = original;
        }
      }

      textEl.addEventListener('blur', commit, { once: true });

      textEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          textEl.contentEditable = 'false';
          textEl.textContent = original;
        }
      }, { once: true });
    }

    function renderListInto(goals, listEl, emptyEl, key, readOnly = false) {
      listEl.innerHTML = '';

      if (goals.length === 0) {
        emptyEl.style.display = 'block';
        return;
      }

      emptyEl.style.display = 'none';

      const visible = goals.slice(0, 5);
      const hidden = goals.slice(5);

      visible.forEach((goal, idx) => {
        listEl.appendChild(buildGoalRow(goal, idx, key, readOnly));
      });

      if (hidden.length > 0) {
        const showMoreRow = document.createElement('div');
        showMoreRow.className = 'show-more-row';
        showMoreRow.textContent = `Show ${hidden.length} more ▾`;
        showMoreRow.addEventListener('click', () => {
          hidden.forEach((goal, idx) => {
            listEl.appendChild(buildGoalRow(goal, 5 + idx, key, readOnly));
          });
          showMoreRow.remove();
        });
        listEl.appendChild(showMoreRow);
      }
    }

    function renderTodayHeader() {
      const todayKey = `goals:${getActiveDateString()}`;
      const goals = storeGet(todayKey) || [];
      const done = goals.filter(g => g.done).length;
      const total = goals.length;

      document.getElementById('gmProgressNum').textContent = done;
      document.getElementById('gmProgressTotal').textContent = `/ ${total}`;

      if (total === 0) {
        document.getElementById('gmProgressLabel').textContent = 'no goals yet';
      } else if (done === total) {
        document.getElementById('gmProgressLabel').textContent = 'all done — solid day';
      } else {
        document.getElementById('gmProgressLabel').textContent = 'complete';
      }

      const barEl = document.getElementById('gmBar');
      barEl.innerHTML = '';
      goals.forEach(goal => {
        const seg = document.createElement('div');
        seg.className = 'gm-bar-seg';
        if (goal.done) seg.classList.add('gm-bar-seg-done');
        barEl.appendChild(seg);
      });

      const card = document.getElementById('gmCardToday');
      if (done === total && total > 0) {
        card.classList.add('gm-all-done');
      } else {
        card.classList.remove('gm-all-done');
      }

      const pushBtn = document.getElementById('gmPushBtn');
      const unchecked = goals.filter(g => !g.done);
      pushBtn.style.display = unchecked.length > 0 ? 'block' : 'none';

      document.getElementById('todayLabel').textContent = `Today — ${formatDate(getActiveDateString())}`;
    }

    function renderStreak() {
      const streak = storeGet('goal_streak_v1') || { count: 0, lastProcessedDate: null };
      document.getElementById('gmStreakNum').textContent = streak.count;
      const streakEl = document.getElementById('gmStreak');
      if (streak.count > 0) {
        streakEl.classList.add('gm-streak-active');
      } else {
        streakEl.classList.remove('gm-streak-active');
      }
    }

    function renderTomorrowCount() {
      const tomorrowKey = `goals:${getTomorrowDateString()}`;
      const goals = storeGet(tomorrowKey) || [];
      document.getElementById('gmTomorrowCount').textContent = `${goals.length} planned`;
      document.getElementById('tomorrowLabel').textContent = `Plan tomorrow — ${formatDate(getTomorrowDateString())}`;
    }

    function loadToday() {
      const todayKey = `goals:${getActiveDateString()}`;
      const goals = storeGet(todayKey) || [];
      renderListInto(goals, document.getElementById('goalList'), document.getElementById('emptyState'), todayKey, false);
      renderTodayHeader();
    }

    function loadTomorrow() {
      const tomorrowKey = `goals:${getTomorrowDateString()}`;
      const goals = storeGet(tomorrowKey) || [];
      renderListInto(goals, document.getElementById('tomorrowList'), document.getElementById('emptyStateTomorrow'), tomorrowKey, true);
      renderTomorrowCount();
    }

    // ===== ADD HANDLERS =====
    function makeAddHandlers(input, addBtn, polishBtn, getKey, statusEl, reload) {
      addBtn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) return;

        const key = getKey();
        const goals = storeGet(key) || [];
        goals.push({ text, done: false });
        storeSet(key, goals);
        input.value = '';
        reload();
        window.dispatchEvent(new CustomEvent('goals-changed'));
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          addBtn.click();
        }
      });

      polishBtn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) return;

        const key = getKey();

        if (!ANTHROPIC_API_KEY) {
          const goals = storeGet(key) || [];
          goals.push({ text, done: false });
          storeSet(key, goals);
          input.value = '';
          statusEl.textContent = 'Polish needs an Anthropic API key — added as-typed.';
          statusEl.style.color = 'var(--text-tertiary)';
          setTimeout(() => { statusEl.textContent = ''; }, 3500);
          reload();
          window.dispatchEvent(new CustomEvent('goals-changed'));
          return;
        }

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-5',
              max_tokens: 1000,
              messages: [{
                role: 'user',
                content: `Clean up this goal and return it as a one-element JSON array of strings, no preamble, no fences: "${text}"`
              }]
            })
          });

          if (!response.ok) throw new Error('API error');
          const data = await response.json();
          const content = data.content[0].text;
          const polished = JSON.parse(content)[0];

          const goals = storeGet(key) || [];
          goals.push({ text: polished, done: false });
          storeSet(key, goals);
          input.value = '';
          statusEl.textContent = '';
          reload();
          window.dispatchEvent(new CustomEvent('goals-changed'));
        } catch (error) {
          const goals = storeGet(key) || [];
          goals.push({ text, done: false });
          storeSet(key, goals);
          input.value = '';
          statusEl.textContent = 'Polish failed — added as-typed.';
          statusEl.style.color = 'var(--danger)';
          setTimeout(() => { statusEl.textContent = ''; }, 3500);
          reload();
          window.dispatchEvent(new CustomEvent('goals-changed'));
        }
      });
    }

    // ===== CLOUD SYNC POLLING =====
    function startCloudSync() {
      pullFromCloud();
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(pullFromCloud, SYNC_POLL_MS);

      window.addEventListener('focus', pullFromCloud);
      window.addEventListener('visibilitychange', () => {
        if (!document.hidden) pullFromCloud();
      });

      document.addEventListener('focusout', () => {
        if (pendingRemote) {
          let changed = false;
          for (const [key, value] of Object.entries(pendingRemote)) {
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
          }
          pendingRemote = null;
        }
      }, true);
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

    document.getElementById('gmPushBtn').addEventListener('click', () => {
      if (confirm('Push all remaining goals to tomorrow?')) {
        const todayKey = `goals:${getActiveDateString()}`;
        const tomorrowKey = `goals:${getTomorrowDateString()}`;
        const today = storeGet(todayKey) || [];
        const tomorrow = storeGet(tomorrowKey) || [];

        const unchecked = today.filter(g => !g.done);
        const existingTexts = new Set(tomorrow.map(g => g.text));

        unchecked.forEach(goal => {
          if (!existingTexts.has(goal.text)) {
            tomorrow.push({ text: goal.text, done: false });
          }
        });

        const todayChecked = today.filter(g => g.done);
        storeSet(todayKey, todayChecked);
        storeSet(tomorrowKey, tomorrow);

        loadToday();
        loadTomorrow();
        window.dispatchEvent(new CustomEvent('goals-changed'));
      }
    });

    makeAddHandlers(
      document.getElementById('goalInput'),
      document.getElementById('goalAddBtn'),
      document.getElementById('goalPolishBtn'),
      () => `goals:${getActiveDateString()}`,
      document.getElementById('polishStatus'),
      loadToday
    );

    makeAddHandlers(
      document.getElementById('tomorrowInput'),
      document.getElementById('tomorrowAddBtn'),
      document.getElementById('tomorrowPolishBtn'),
      () => `goals:${getTomorrowDateString()}`,
      document.getElementById('tomorrowStatus'),
      loadTomorrow
    );

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

    // Check if user is already logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
      currentUser = { email: localStorage.getItem('user_email') };
      showDashboard();
    } else {
      showAuthPage();
    }
  