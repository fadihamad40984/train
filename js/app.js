const STORAGE_KEY = 'cs-training-progress';
const THEME_KEY = 'cs-training-theme';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { modules: {}, faqs: {} };
  } catch {
    return { modules: {}, faqs: {} };
  }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let progress = loadProgress();
let currentSection = 'dashboard';
let errorFilter = '';
let errorFilterMode = 'all';
let searchResultsCache = [];
let searchActiveIndex = -1;
let searchDebounceTimer = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function init() {
  initTheme();
  renderNav();
  renderDashboard();
  renderAllSections();
  updateProgress();
  bindEvents();
  navigateTo('dashboard');
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
}

function bindEvents() {
  const searchInput = $('#globalSearch');
  const searchClear = $('#searchClear');
  const searchResults = $('#searchResults');

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => runSearch(searchInput.value), 180);
    searchClear.hidden = !searchInput.value.trim();
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) runSearch(searchInput.value);
  });

  searchInput.addEventListener('keydown', handleSearchKeydown);

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.hidden = true;
    hideSearchResults();
    searchInput.focus();
  });

  searchResults.addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item');
    if (!item || item.dataset.empty) return;
    goToResult(item.dataset.section, item.dataset.index);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) hideSearchResults();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (e.key === 'Escape' && document.activeElement === searchInput) {
      hideSearchResults();
      searchInput.blur();
    }
  });

  $('#menuToggle').addEventListener('click', toggleSidebar);
  $('#sidebarOverlay').addEventListener('click', closeSidebar);
  $('#themeToggle').addEventListener('click', toggleTheme);
}

function toggleSidebar() {
  $('.sidebar').classList.toggle('open');
  $('#sidebarOverlay').classList.toggle('open');
}

function closeSidebar() {
  $('.sidebar').classList.remove('open');
  $('#sidebarOverlay').classList.remove('open');
}

function renderNav() {
  const nav = $('#sidebarNav');
  const sections = [
    { id: 'dashboard', label: 'لوحة التحكم', dot: 'general' },
    { id: 'training', label: 'تتبع التدريب', dot: 'general' },
    { divider: 'نيوكاش' },
    { id: 'workflow', label: 'سير العمل', dot: 'neocash' },
    { id: 'verification', label: 'التحقق من الهوية', dot: 'neocash' },
    { id: 'service-flows', label: 'توجيه المكالمات', dot: 'neocash' },
    { id: 'pos-faq', label: 'أسئلة POS', dot: 'neocash' },
    { id: 'softpos-guide', label: 'دليل Soft POS', dot: 'neocash' },
    { id: 'cards-faq', label: 'أسئلة البطاقات', dot: 'neocash' },
    { id: 'errors', label: 'أكواد الأخطاء', dot: 'neocash' },
    { id: 'softpos-errors', label: 'أخطاء Soft POS', dot: 'neocash' },
    { id: 'service-centers', label: 'مراكز الخدمات', dot: 'neocash' },
    { divider: 'يبوس' },
    { id: 'yabos-general', label: 'معلومات عامة', dot: 'yabos' },
    { id: 'yabos-registration', label: 'التسجيل', dot: 'yabos' },
    { id: 'yabos-idplus', label: 'الهوية الرقمية', dot: 'yabos' },
    { id: 'yabos-login', label: 'تسجيل الدخول', dot: 'yabos' },
    { id: 'yabos-points', label: 'المخصصات والنقاط', dot: 'yabos' },
    { id: 'yabos-usage', label: 'استخدام النقاط', dot: 'yabos' },
    { id: 'yabos-bills', label: 'دفع الفواتير', dot: 'yabos' },
    { id: 'yabos-device', label: 'الجهاز والتطبيق', dot: 'yabos' },
    { id: 'yabos-profile', label: 'الملف الشخصي', dot: 'yabos' },
    { id: 'yabos-security', label: 'الأمان', dot: 'yabos' },
    { id: 'yabos-escalation', label: 'قواعد التحويل', dot: 'yabos' }
  ];

  nav.innerHTML = sections.map(s => {
    if (s.divider) return `<div class="nav-section"><div class="nav-section-title">${s.divider}</div></div>`;
    const yabosClass = s.dot === 'yabos' ? ' yabos' : '';
    return `<button class="nav-link${yabosClass}" data-section="${s.id}">
      <span class="nav-dot ${s.dot}"></span>${s.label}
    </button>`;
  }).join('');

  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navigateTo(link.dataset.section);
      closeSidebar();
    });
  });
}

function navigateTo(sectionId) {
  currentSection = sectionId;
  $$('.section').forEach(s => s.classList.remove('active'));
  const target = $(`#section-${sectionId}`);
  if (target) target.classList.add('active');

  $$('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.section === sectionId);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderDashboard() {
  const d = TRAINING_DATA;
  const totalModules = d.trainingModules.length;
  const doneModules = d.trainingModules.filter(m => progress.modules[m.id]).length;
  const totalFaqs = countAllFaqs();
  const doneFaqs = Object.keys(progress.faqs).filter(k => progress.faqs[k]).length;

  $('#dashboardStats').innerHTML = `
    <div class="quick-ref">
      <div class="quick-ref-item"><div class="num">${d.errorCodes.length}</div><div class="label">كود خطأ (كامل)</div></div>
      <div class="quick-ref-item"><div class="num">${d.errorCodes.filter(c => c.common).length}</div><div class="label">كود شائع</div></div>
      <div class="quick-ref-item"><div class="num">${d.posFaq.length + d.softPosGuide.length + d.cardsFaq.length}</div><div class="label">سيناريو نيوكاش</div></div>
      <div class="quick-ref-item"><div class="num">${countYabosFaqs()}</div><div class="label">سيناريو يبوس</div></div>
      <div class="quick-ref-item"><div class="num">${totalModules}</div><div class="label">وحدة تدريب</div></div>
    </div>
    <div class="dashboard-grid">
      <div class="app-card neocash" onclick="navigateTo('workflow')">
        <span class="badge neocash">نيوكاش</span>
        <h2>NeoCash</h2>
        <p class="subtitle">${d.apps[0].description}</p>
        <div class="stat">
          <span>POS & Soft POS</span>
          <span>البطاقات</span>
          <span>المحفظة</span>
        </div>
      </div>
      <div class="app-card yabos" onclick="navigateTo('yabos-general')">
        <span class="badge yabos">يبوس</span>
        <h2>Yabos</h2>
        <p class="subtitle">${d.apps[1].description}</p>
        <div class="stat">
          <span>المخصصات</span>
          <span>الفواتير</span>
          <span>ID Plus</span>
        </div>
      </div>
    </div>
    <div class="card" style="margin-top:0.5rem">

    </div>
  `;
}

function countAllFaqs() {
  const y = TRAINING_DATA.yabos;
  return TRAINING_DATA.posFaq.length + TRAINING_DATA.softPosGuide.length +
    TRAINING_DATA.cardsFaq.length + TRAINING_DATA.serviceCenters.items.length + countYabosFaqs();
}

function countYabosFaqs() {
  const y = TRAINING_DATA.yabos;
  return y.general.length + y.registration.length + y.idPlus.length +
    y.login.length + y.points.length + y.usage.length +
    y.bills.length + y.device.length + y.profile.length + y.security.length;
}

function renderAllSections() {
  renderWorkflow();
  renderVerification();
  renderServiceFlows();
  renderFaqSection('pos-faq', 'أسئلة التجار - POS', TRAINING_DATA.posFaq, 'neocash');
  renderFaqSection('softpos-guide', 'دليل Soft POS', TRAINING_DATA.softPosGuide, 'neocash');
  renderFaqSection('cards-faq', 'أسئلة البطاقات مسبقة الدفع', TRAINING_DATA.cardsFaq, 'neocash');
  renderErrors();
  renderSoftPosErrors();
  renderServiceCenters();
  renderYabosSections();
  renderTraining();
}

function renderServiceCenters() {
  const sc = TRAINING_DATA.serviceCenters;
  renderFaqSection('service-centers', sc.title, sc.items, 'neocash');
}

function renderWorkflow() {
  const w = TRAINING_DATA.workflow;
  $('#section-workflow').innerHTML = `
    <div class="section-header">
      <span class="badge neocash">نيوكاش</span>
      <h2>${w.title}</h2>
      <p>الأهداف العامة والمهام الرئيسية لمركز الاتصال</p>
    </div>
    <div class="grid-2">
      <div class="card"><h3>الأهداف</h3><ul>${w.goals.map(g => `<li>${g}</li>`).join('')}</ul></div>
      <div class="card"><h3>المهام الرئيسية</h3><ul>${w.tasks.map(t => `<li>${t}</li>`).join('')}</ul></div>
      <div class="card"><h3>المعالجة والمتابعة</h3><ul>${w.followUp.map(f => `<li>${f}</li>`).join('')}</ul></div>
      <div class="card"><h3>الإغلاق والتقييم</h3><ul>${w.closing.map(c => `<li>${c}</li>`).join('')}</ul></div>
    </div>
  `;
}

function renderVerification() {
  const v = TRAINING_DATA.verification;
  $('#section-verification').innerHTML = `
    <div class="section-header">
      <span class="badge neocash">نيوكاش</span>
      <h2>${v.title}</h2>
      <p>${v.greeting}</p>
    </div>
    <div class="grid-2">
      ${v.types.map(t => `
        <div class="card">
          <h3>${t.type}</h3>
          <ul>${t.checks.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>
      `).join('')}
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>تصنيف نوع الخدمة</h3>
      <div class="purpose-tags">
        ${v.categories.map(c => `<span class="purpose-tag">${c}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderServiceFlows() {
  const flows = TRAINING_DATA.serviceFlows;
  $('#section-service-flows').innerHTML = `
    <div class="section-header">
      <span class="badge neocash">نيوكاش</span>
      <h2>توجيه المكالمة حسب التصنيف</h2>
      <p>الأسئلة الأساسية والإجراءات لكل نوع خدمة</p>
    </div>
    ${flows.map(f => `
      <div class="flow-card">
        <h3>${f.title}</h3>
        <div class="purpose-tags">${f.purposes.map(p => `<span class="purpose-tag">${p}</span>`).join('')}</div>
        <div class="flow-questions">
          <h4>الأسئلة الأساسية</h4>
          <ol>${f.questions.map(q => `<li>${q}</li>`).join('')}</ol>
        </div>
        <div class="flow-actions">
          <h4>الإجراء</h4>
          <ul style="list-style:none;padding:0">
            ${f.actions.map(a => `<li style="color:var(--text-muted);font-size:0.88rem;padding:0.2rem 0">→ ${a}</li>`).join('')}
          </ul>
        </div>
      </div>
    `).join('')}
  `;
}

function faqId(section, index) {
  return `${section}-${index}`;
}

function renderFaqSection(sectionId, title, items, app) {
  const badge = app === 'neocash' ? 'neocash' : 'yabos';
  const html = `
    <div class="section-header">
      <span class="badge ${badge}">${app === 'neocash' ? 'نيوكاش' : 'يبوس'}</span>
      <h2>${title}</h2>
      <p>${items.length} سيناريو — اضغط للتوسيع، علّم ✓ عند الحفظ</p>
    </div>
    <div class="faq-list">
      ${items.map((item, i) => {
        const id = faqId(sectionId, i);
        const checked = progress.faqs[id] ? 'checked' : '';
        const escalate = item.escalate ? ' escalate' : '';
        return `
          <div class="faq-item${escalate}" data-faq="${id}">
            <div class="faq-question" onclick="toggleFaq(this.parentElement)">
              <div class="faq-check ${checked}" onclick="event.stopPropagation();toggleFaqCheck('${id}', this)"></div>
              <div class="faq-q-text">${item.q}</div>
              <span class="faq-toggle">▼</span>
            </div>
            <div class="faq-answer">${item.a}${item.escalate ? '<br><br><span class="badge warning">تحويل لـ ID Plus</span>' : ''}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  $(`#section-${sectionId}`).innerHTML = html;
}

function renderErrors() {
  const total = TRAINING_DATA.errorCodes.length;
  const common = TRAINING_DATA.errorCodes.filter(c => c.common).length;
  const src = TRAINING_DATA.errorCodesSource;

  $('#section-errors').innerHTML = `
    <div class="section-header">
      <span class="badge neocash">نيوكاش</span>
      <h2>أكواد أخطاء الحركات</h2>
      <p>${total} كود من <strong>${src.full}</strong> — ${common} كود شائع من <strong>${src.quick}</strong> — متطابق 100%</p>
    </div>
    <div class="error-toolbar">
      <div class="error-filters">
        <button type="button" class="error-filter-btn active" data-mode="all" onclick="setErrorFilterMode('all', this)">الكل (${total})</button>
        <button type="button" class="error-filter-btn" data-mode="common" onclick="setErrorFilterMode('common', this)">الشائعة فقط (${common})</button>
      </div>
      <div class="error-search">
        <input type="text" id="errorCodeSearch" placeholder="ابحث بالكود (مثال: 51) أو الوصف (مثال: رصيد)..." oninput="filterErrors(this.value)">
      </div>
    </div>
    <div class="error-table-wrap">
      <table class="error-table" id="errorTable">
        <thead><tr><th>الكود</th><th>الوصف بالعربية</th><th>English</th></tr></thead>
        <tbody>${renderErrorRows(getFilteredErrorCodes())}</tbody>
      </table>
    </div>
  `;
}

function getFilteredErrorCodes() {
  let codes = TRAINING_DATA.errorCodes;
  if (errorFilterMode === 'common') codes = codes.filter(c => c.common);
  if (errorFilter) {
    const q = errorFilter.toLowerCase();
    codes = codes.filter(e =>
      e.code.includes(q) ||
      e.ar.toLowerCase().includes(q) ||
      (e.arShort && e.arShort.toLowerCase().includes(q)) ||
      e.en.toLowerCase().includes(q)
    );
  }
  return codes;
}

function setErrorFilterMode(mode, btn) {
  errorFilterMode = mode;
  $$('.error-filter-btn').forEach(b => b.classList.toggle('active', b === btn));
  $('#errorTable tbody').innerHTML = renderErrorRows(getFilteredErrorCodes());
}

function renderErrorRows(codes) {
  if (!codes.length) {
    return `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:2rem">لا توجد نتائج</td></tr>`;
  }
  return codes.map(e => {
    const shortNote = e.arShort && e.common
      ? `<div class="error-short-note">وصف مختصر: ${e.arShort}</div>`
      : '';
    const commonBadge = e.common ? '<span class="error-common-tag">شائع</span> ' : '';
    return `
    <tr>
      <td><span class="error-code">${e.code}</span></td>
      <td>${commonBadge}${e.ar}${shortNote}</td>
      <td style="color:var(--text-muted)">${e.en}</td>
    </tr>
  `;
  }).join('');
}

function filterErrors(query) {
  errorFilter = query.trim();
  $('#errorTable tbody').innerHTML = renderErrorRows(getFilteredErrorCodes());
}

function renderSoftPosErrors() {
  const items = TRAINING_DATA.softPosErrors;
  $('#section-softpos-errors').innerHTML = `
    <div class="section-header">
      <span class="badge neocash">نيوكاش</span>
      <h2>أخطاء Soft POS</h2>
      <p>${items.length} رسالة رفض من Softpos-Error.pdf — متطابق 100%</p>
    </div>
    <div class="error-table-wrap">
      <table class="error-table">
        <thead><tr><th>رسالة الخطأ</th><th>المعنى بالعربية</th></tr></thead>
        <tbody>
          ${items.map(e => `
            <tr>
              <td><span class="error-code" style="font-size:0.8rem">${e.error}</span></td>
              <td>${e.ar}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderYabosSections() {
  const y = TRAINING_DATA.yabos;
  const sections = [
    { id: 'yabos-general', title: 'معلومات عامة', items: y.general },
    { id: 'yabos-registration', title: 'التسجيل وإنشاء الحساب', items: y.registration },
    { id: 'yabos-idplus', title: 'مشاكل الهوية الرقمية ID Plus', items: y.idPlus },
    { id: 'yabos-login', title: 'تسجيل الدخول', items: y.login },
    { id: 'yabos-points', title: 'المخصصات والنقاط', items: y.points },
    { id: 'yabos-usage', title: 'استخدام النقاط', items: y.usage },
    { id: 'yabos-bills', title: 'دفع الفواتير والعمليات', items: y.bills },
    { id: 'yabos-device', title: 'الجهاز والتطبيق', items: y.device },
    { id: 'yabos-profile', title: 'الملف الشخصي', items: y.profile },
    { id: 'yabos-security', title: 'الأمان', items: y.security }
  ];
  sections.forEach(s => renderFaqSection(s.id, s.title, s.items, 'yabos'));

  $('#section-yabos-escalation').innerHTML = `
    <div class="section-header">
      <span class="badge yabos">يبوس</span>
      <h2>قواعد التحويل والتصعيد</h2>
      <p>متى تحوّل لـ ID Plus ومتى تتعامل أنت كمركز اتصال يبوس</p>
    </div>
    <div class="escalation-box">
      <div class="escalation-card idplus">
        <h3>⚠️ تحويل لمركز دعم ID Plus</h3>
        <ul>${y.escalation.toIdPlus.map(i => `<li style="padding:0.3rem 0;color:var(--text-muted);font-size:0.88rem">• ${i}</li>`).join('')}</ul>
      </div>
      <div class="escalation-card yabos">
        <h3>✅ يتعامل معها مركز اتصال يبوس</h3>
        <ul>${y.escalation.toYabos.map(i => `<li style="padding:0.3rem 0;color:var(--text-muted);font-size:0.88rem">• ${i}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="card" style="margin-top:1.5rem">
      <h3>المعلومات المطلوبة عند الرد على طلب</h3>
      <div class="purpose-tags">${y.requiredInfo.map(i => `<span class="purpose-tag">${i}</span>`).join('')}</div>
      <p style="margin-top:0.75rem;color:var(--text-muted);font-size:0.9rem">⏱ وقت الرد على الشكاوى: <strong style="color:var(--text)">${y.responseTime}</strong></p>
    </div>
  `;
}

function renderTraining() {
  const modules = TRAINING_DATA.trainingModules;
  $('#section-training').innerHTML = `
    <div class="section-header">
      <h2>تتبع التدريب</h2>
      <p>علّم كل وحدة عند إتمام مراجعتها — يُحفظ تلقائياً</p>
    </div>
    <div class="training-grid">
      ${modules.map(m => {
        const done = progress.modules[m.id] ? 'done' : '';
        const appLabel = m.app === 'neocash' ? 'نيوكاش' : 'يبوس';
        const appColor = m.app === 'neocash' ? 'var(--neocash)' : 'var(--yabos)';
        return `
          <div class="training-item ${done}" onclick="toggleModule('${m.id}', this)">
            <div class="check">${progress.modules[m.id] ? '✓' : ''}</div>
            <div class="info">
              <div class="title">${m.title}</div>
              <div class="meta" style="color:${appColor}">${appLabel}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function toggleModule(id, el) {
  progress.modules[id] = !progress.modules[id];
  saveProgress(progress);
  el.classList.toggle('done', progress.modules[id]);
  el.querySelector('.check').textContent = progress.modules[id] ? '✓' : '';
  updateProgress();
}

function toggleFaq(id, el) {
  progress.faqs[id] = !progress.faqs[id];
  saveProgress(progress);
  el.classList.toggle('checked', progress.faqs[id]);
  updateProgress();
}

function toggleFaqCheck(id, el) {
  toggleFaq(id, el);
}

function toggleFaq(item) {
  item.classList.toggle('open');
}

function updateProgress() {
  const total = TRAINING_DATA.trainingModules.length;
  const done = TRAINING_DATA.trainingModules.filter(m => progress.modules[m.id]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $('#progressPct').textContent = `${pct}%`;
  $('#progressFill').style.width = `${pct}%`;
  $('#progressLabel').textContent = `${done} من ${total} وحدة مكتملة`;
}

function normalizeSearchText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlightMatch(text, query) {
  const safe = escapeHtml(text);
  if (!query) return safe;
  const lowerText = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  let idx = lowerText.indexOf(lowerQ);
  let len = query.length;
  if (idx === -1) {
    const normText = normalizeSearchText(text);
    const normQ = normalizeSearchText(query);
    idx = normText.indexOf(normQ);
    if (idx === -1) return safe;
    len = normQ.length;
  }
  return `${escapeHtml(text.slice(0, idx))}<mark>${escapeHtml(text.slice(idx, idx + len))}</mark>${escapeHtml(text.slice(idx + len))}`;
}

function runSearch(rawQuery) {
  const q = normalizeSearchText(rawQuery);
  if (!q) {
    hideSearchResults();
    return;
  }

  const results = [];
  const match = (text) => normalizeSearchText(text).includes(q);

  const pushFaq = (items, section, app, sectionId, type) => {
    items.forEach((item, i) => {
      if (match(item.q) || match(item.a)) {
        results.push({ q: item.q, a: item.a, app, section, sectionId, index: i, type });
      }
    });
  };

  pushFaq(TRAINING_DATA.posFaq, 'أسئلة POS', 'نيوكاش', 'pos-faq', 'neocash');
  pushFaq(TRAINING_DATA.softPosGuide, 'دليل Soft POS', 'نيوكاش', 'softpos-guide', 'neocash');
  pushFaq(TRAINING_DATA.cardsFaq, 'أسئلة البطاقات', 'نيوكاش', 'cards-faq', 'neocash');
  pushFaq(TRAINING_DATA.serviceCenters.items, 'مراكز الخدمات', 'نيوكاش', 'service-centers', 'neocash');

  TRAINING_DATA.serviceFlows.forEach(flow => {
    const blob = [flow.title, ...flow.purposes, ...flow.questions, ...flow.actions].join(' ');
    if (match(blob) || match(flow.title)) {
      results.push({
        q: flow.title,
        a: flow.questions[0] || flow.actions[0] || '',
        app: 'نيوكاش',
        section: 'توجيه المكالمات',
        sectionId: 'service-flows',
        index: null,
        type: 'neocash'
      });
    }
  });

  const y = TRAINING_DATA.yabos;
  const yabosSections = [
    { items: y.general, label: 'معلومات عامة', id: 'yabos-general' },
    { items: y.registration, label: 'التسجيل', id: 'yabos-registration' },
    { items: y.idPlus, label: 'ID Plus', id: 'yabos-idplus' },
    { items: y.login, label: 'تسجيل الدخول', id: 'yabos-login' },
    { items: y.points, label: 'المخصصات', id: 'yabos-points' },
    { items: y.usage, label: 'استخدام النقاط', id: 'yabos-usage' },
    { items: y.bills, label: 'دفع الفواتير', id: 'yabos-bills' },
    { items: y.device, label: 'الجهاز', id: 'yabos-device' },
    { items: y.profile, label: 'الملف الشخصي', id: 'yabos-profile' },
    { items: y.security, label: 'الأمان', id: 'yabos-security' }
  ];
  yabosSections.forEach(s => pushFaq(s.items, s.label, 'يبوس', s.id, 'yabos'));

  TRAINING_DATA.errorCodes.forEach(e => {
    if (match(e.code) || match(e.ar) || match(e.arShort) || match(e.en)) {
      results.push({
        q: `كود ${e.code}: ${e.ar}`,
        a: e.en,
        app: 'نيوكاش',
        section: 'أكواد الأخطاء',
        sectionId: 'errors',
        index: null,
        type: 'error'
      });
    }
  });

  TRAINING_DATA.softPosErrors.forEach(e => {
    if (match(e.error) || match(e.ar)) {
      results.push({
        q: e.error,
        a: e.ar,
        app: 'نيوكاش',
        section: 'أخطاء Soft POS',
        sectionId: 'softpos-errors',
        index: null,
        type: 'error'
      });
    }
  });

  showSearchResults(results.slice(0, 20), rawQuery.trim());
}

function handleSearchKeydown(e) {
  const items = $$('.search-result-item:not([data-empty])');
  if (!items.length || $('#searchResults').hidden) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    searchActiveIndex = Math.min(searchActiveIndex + 1, items.length - 1);
    updateSearchActiveItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    searchActiveIndex = Math.max(searchActiveIndex - 1, 0);
    updateSearchActiveItem(items);
  } else if (e.key === 'Enter' && searchActiveIndex >= 0) {
    e.preventDefault();
    const item = items[searchActiveIndex];
    goToResult(item.dataset.section, item.dataset.index);
  }
}

function updateSearchActiveItem(items) {
  items.forEach((el, i) => el.classList.toggle('active', i === searchActiveIndex));
  items[searchActiveIndex]?.scrollIntoView({ block: 'nearest' });
}

function showSearchResults(results, query) {
  const container = $('#searchResults');
  const box = $('#searchBox');
  const field = $('.search-field');
  searchResultsCache = results;
  searchActiveIndex = results.length ? 0 : -1;

  box.setAttribute('aria-expanded', 'true');
  field.classList.add('has-results');
  container.hidden = false;

  if (!results.length) {
    container.innerHTML = `
      <div class="search-results-empty" data-empty="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
        <div>لا توجد نتائج لـ <mark>${escapeHtml(query)}</mark></div>
        <div style="margin-top:0.35rem;font-size:0.8rem">جرّب كود خطأ (مثل 51) أو كلمة مفتاحية أخرى</div>
      </div>`;
    return;
  }

  const typeLabel = { neocash: 'نيوكاش', yabos: 'يبوس', error: 'خطأ' };

  container.innerHTML = `
    <div class="search-results-header">${results.length} نتيجة — Enter للانتقال، ↑↓ للتنقل</div>
    ${results.map((r, i) => `
      <div class="search-result-item${i === 0 ? ' active' : ''}"
           role="option"
           data-section="${r.sectionId}"
           data-index="${r.index ?? ''}"
           aria-selected="${i === 0}">
        <div class="result-meta">
          <span class="result-type ${r.type}">${typeLabel[r.type] || r.app}</span>
          <span class="result-section">${escapeHtml(r.section)}</span>
        </div>
        <div class="result-q">${highlightMatch(r.q, query)}</div>
        <div class="result-a">${highlightMatch(r.a, query)}</div>
      </div>
    `).join('')}
  `;
}

function hideSearchResults() {
  const container = $('#searchResults');
  const box = $('#searchBox');
  const field = $('.search-field');
  container.hidden = true;
  container.innerHTML = '';
  box.setAttribute('aria-expanded', 'false');
  field?.classList.remove('has-results');
  searchActiveIndex = -1;
  searchResultsCache = [];
}

function goToResult(sectionId, index) {
  hideSearchResults();
  const searchInput = $('#globalSearch');
  searchInput.value = '';
  $('#searchClear').hidden = true;
  navigateTo(sectionId);
  if (index !== '' && index !== 'null' && index != null) {
    setTimeout(() => {
      const item = document.querySelector(`[data-faq="${sectionId}-${index}"]`);
      if (item) {
        item.classList.add('open');
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  }
}

document.addEventListener('DOMContentLoaded', init);
