/* Shekulli.info — small UI behaviors (menu + search) */

(function () {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function setScrollLock(locked) {
    document.documentElement.style.overflow = locked ? 'hidden' : '';
  }

  function ensureShell() {
    if (qs('#ui-shell')) return;

    const shell = document.createElement('div');
    shell.id = 'ui-shell';
    shell.innerHTML = `
      <div class="ui-backdrop" hidden></div>

      <aside class="ui-drawer" hidden aria-hidden="true" aria-label="Menu">
        <div class="ui-drawer__top">
          <button class="icon-btn" type="button" data-ui-close aria-label="Mbyll menunë">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          <a href="/" class="ui-drawer__brand">
            <img class="masthead__logo" src="assets/logo.png" alt="Shekulli.info">
          </a>
        </div>
        <nav class="ui-drawer__nav" id="ui-drawer-links"></nav>
      </aside>

      <section class="ui-search" hidden aria-hidden="true" aria-label="Kërko">
        <div class="ui-search__top">
          <div class="ui-search__field">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
            <input class="ui-search__input" type="search" placeholder="Kërko artikuj…" autocomplete="off" />
          </div>
          <button class="btn btn--ghost" type="button" data-ui-close>Mbyll</button>
        </div>
        <div class="ui-search__results" id="ui-search-results"></div>
      </section>
    `;

    document.body.appendChild(shell);

    const backdrop = qs('.ui-backdrop', shell);
    backdrop.addEventListener('click', closeAll);

    qsa('[data-ui-close]', shell).forEach((b) => b.addEventListener('click', closeAll));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll();
    });
  }

  function closeAll() {
    const shell = qs('#ui-shell');
    if (!shell) return;
    const drawer = qs('.ui-drawer', shell);
    const search = qs('.ui-search', shell);
    const backdrop = qs('.ui-backdrop', shell);

    [drawer, search].forEach((el) => {
      if (!el) return;
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
    });
    if (backdrop) backdrop.hidden = true;
    setScrollLock(false);

    const btn = qs('[data-action="menu"]');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function openDrawer() {
    ensureShell();
    const shell = qs('#ui-shell');
    const search = qs('.ui-search', shell);
    if (search && !search.hidden) { search.hidden = true; search.setAttribute('aria-hidden','true'); }
    const drawer = qs('.ui-drawer', shell);
    const backdrop = qs('.ui-backdrop', shell);

    // Build links from the existing masthead nav items.
    const links = qs('#ui-drawer-links', shell);
    if (links && links.childElementCount === 0) {
      const navItems = qsa('.masthead__nav .masthead__nav-item');
      navItems.forEach((a) => {
        const copy = a.cloneNode(true);
        copy.classList.remove('is-active');
        copy.classList.add('ui-drawer__link');
        links.appendChild(copy);
      });
    }

    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false;
    setScrollLock(true);

    const btn = qs('[data-action="menu"]');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  function searchIndex(q) {
    const api = window.ShekullDB;
    if (!api || typeof api.getArticles !== 'function') return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return [];

    const all = api.getArticles();
    const score = (a) => {
      const title = (a.title || '').toLowerCase();
      const standfirst = (a.standfirst || '').toLowerCase();
      const body = (a.body || '').toLowerCase();
      let s = 0;
      if (title.includes(needle)) s += 6;
      if (standfirst.includes(needle)) s += 3;
      if (body.includes(needle)) s += 1;
      if ((a.category || '').toLowerCase().includes(needle)) s += 2;
      return s;
    };

    return all
      .map((a) => ({ a, s: score(a) }))
      .filter((x) => x.s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 12)
      .map((x) => x.a);
  }

  const CATEGORIES = ['Politikë','Kosovë','Botë','Ekonomi','Sport','Kulturë','Opinion'];

  function renderSearchResults(results, q) {
    const shell = qs('#ui-shell');
    const resultsEl = qs('#ui-search-results', shell);
    if (!resultsEl) return;

    if (!q.trim()) {
      // Recommendations: category chips + 4 recent articles
      const api = window.ShekullDB;
      const recent = (api && typeof api.getArticles === 'function') ? api.getArticles().slice(0, 4) : [];

      const chips = CATEGORIES.map(cat =>
        `<a class="ui-search__chip" href="category?cat=${encodeURIComponent(cat)}">${cat}</a>`
      ).join('');

      const recentHtml = recent.map(a =>
        `<a class="ui-result" href="article?id=${encodeURIComponent(a.id)}">
          <span style="font-family:var(--font-sans);font-size:10px;font-weight:700;color:var(--brand-red);text-transform:uppercase;letter-spacing:.06em;">${a.category}</span>
          <div class="ui-result__title">${a.title}</div>
        </a>`
      ).join('');

      resultsEl.innerHTML = `
        <div class="ui-search__section-label">Rubrikat</div>
        <div class="ui-search__chips">${chips}</div>
        ${recent.length ? `<div class="ui-search__section-label" style="border-top:1px solid var(--rule);padding-top:12px;">Të fundit</div>${recentHtml}` : ''}
      `;
      return;
    }

    if (results.length === 0) {
      resultsEl.innerHTML = `<p style="font-family:var(--font-sans);font-size:13px;color:var(--ink-3);padding:16px;">Nuk u gjet asgjë për "<strong>${q}</strong>".</p>`;
      return;
    }

    resultsEl.innerHTML = results
      .map((a) => `
        <a class="ui-result" href="article?id=${encodeURIComponent(a.id)}">
          <span style="font-family:var(--font-sans);font-size:10px;font-weight:700;color:var(--brand-red);text-transform:uppercase;letter-spacing:.06em;">${a.category}</span>
          <div class="ui-result__title">${a.title}</div>
        </a>`)
      .join('');
  }

  function openSearch() {
    ensureShell();
    const shell = qs('#ui-shell');
    const search = qs('.ui-search', shell);
    const drawer = qs('.ui-drawer', shell);
    const backdrop = qs('.ui-backdrop', shell);

    if (drawer) {
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    }

    search.hidden = false;
    search.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false;

    const input = qs('.ui-search__input', shell);
    if (input) {
      input.value = '';
      renderSearchResults([], '');
      setTimeout(() => input.focus(), 0);
      input.addEventListener(
        'input',
        () => {
          const q = input.value || '';
          const res = searchIndex(q);
          renderSearchResults(res, q);
        },
        { passive: true }
      );
    }
  }

  function wireButtons() {
    const menuBtn = qs('[data-action="menu"]');
    const searchBtn = qs('[data-action="search"]');

    if (menuBtn) menuBtn.addEventListener('click', openDrawer);
    if (searchBtn) searchBtn.addEventListener('click', openSearch);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireButtons);
  } else {
    wireButtons();
  }
})();

