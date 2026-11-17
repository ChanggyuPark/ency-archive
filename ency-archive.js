(() => {
  'use strict';

  const PATHS = new Set(['/ENCY-Archive', '/ency-archive']);
  const PAGE_ID = 'page2752827';
  const ROOT_ID = 'ency-archive';
  const ROUTE_CLASS = 'ency-archive-route-active';
  const UTM_KEY = 'ency-archive:utm';
  const UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'];
  const installed = Symbol.for('ency-archive.sixshop');
  if (window[installed]) return;
  window[installed] = true;

  const markup = "<section id=\"ency-archive\" aria-label=\"ENCY 기술 자료실\">\n    <div class=\"ea-wrap\">\n      <div class=\"ea-intro\">\n        <h1>ENCY 기술 자료실</h1>\n        <p>제품 소개서부터 가공 가이드까지 필요한 자료를 찾아보세요.</p>\n      </div>\n      <section class=\"ea-featured\" id=\"ea-featured-section\" aria-labelledby=\"ea-featured-heading\">\n        <h2 class=\"ea-section-title\" id=\"ea-featured-heading\">주요 소개서</h2>\n        <p class=\"ea-section-copy\">제품별 소개서를 바로 내려받을 수 있습니다.</p>\n        <div id=\"ea-feature-grid\" class=\"ea-feature-grid\" aria-live=\"polite\"></div>\n      </section>\n      <section aria-labelledby=\"ea-library-heading\">\n        <div class=\"ea-library-head\">\n          <div><h2 class=\"ea-section-title\" id=\"ea-library-heading\">기술 자료</h2><p class=\"ea-section-copy\">카테고리별로 자료를 살펴보세요.</p></div>\n          <form class=\"ea-search-wrap\" role=\"search\">\n            <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><circle cx=\"10.8\" cy=\"10.8\" r=\"6.8\"/><path d=\"m16 16 5 5\"/></svg>\n            <input id=\"ea-search\" class=\"ea-search\" type=\"search\" placeholder=\"자료 검색\" aria-label=\"제목과 설명 검색\" autocomplete=\"off\">\n            <button class=\"ea-search-submit\" type=\"submit\">검색</button>\n          </form>\n        </div>\n        <div id=\"ea-tabs\" class=\"ea-tabs\" role=\"tablist\" aria-label=\"자료 카테고리\"></div>\n        <div class=\"ea-product-filter\">\n          <label for=\"ea-product\">제품별 보기</label>\n          <select id=\"ea-product\"><option value=\"\">전체 제품</option></select>\n          <button id=\"ea-reset\" class=\"ea-retry\" type=\"button\">필터 초기화</button>\n        </div>\n        <p id=\"ea-results\" class=\"ea-results\" role=\"status\" aria-live=\"polite\"></p>\n        <div id=\"ea-card-grid\" class=\"ea-card-grid\"></div>\n        <div id=\"ea-message\" hidden></div>\n      </section>\n    </div>\n  </section>";
  let mounted;

  function teardown() {
    if (!mounted) return;
    mounted.controller.abort();
    mounted.root.remove();
    mounted.page.classList.remove(ROUTE_CLASS);
    mounted = undefined;
  }

  function campaign() {
    const incoming = new URLSearchParams(location.search);
    const current = new URLSearchParams();
    for (const name of UTM_FIELDS) {
      const value = incoming.get(name);
      if (value) current.set(name, value);
    }
    try {
      if (current.size) sessionStorage.setItem(UTM_KEY, current.toString());
      else return new URLSearchParams(sessionStorage.getItem(UTM_KEY) || '');
    } catch {
      // Storage can be disabled. Keep the current URL's campaign data.
    }
    return current;
  }

  function formURL(href) {
    const url = new URL(href);
    if (url.protocol !== 'https:') return href;
    const googleForm = url.hostname === 'docs.google.com' &&
      /^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[^/]+\/viewform\/?$/.test(url.pathname);
    if (!googleForm) return href;

    const params = campaign();
    let changed = false;
    for (const name of UTM_FIELDS) {
      if (params.has(name) && !url.searchParams.has(name)) {
        url.searchParams.set(name, params.get(name));
        changed = true;
      }
    }
    return changed ? url.href : href;
  }

  function reconcile() {
    if (!PATHS.has(location.pathname)) {
      teardown();
      return;
    }
    const page = document.getElementById(PAGE_ID);
    if (mounted && mounted.page === page && mounted.root.isConnected &&
        page.parentElement === mounted.root.parentElement) return;
    teardown();
    if (!page?.parentElement || document.getElementById(ROOT_ID)) return;

    const template = document.createElement('template');
    template.innerHTML = markup;
    const root = template.content.firstElementChild;
    const controller = new AbortController();
    mounted = { root, page, controller };
    try {
      campaign();
      page.after(root);
      startArchive(root, controller.signal);
      page.classList.add(ROUTE_CLASS);
    } catch (error) {
      teardown();
      console.error('[ENCY 자료실] 초기화 실패:', error);
    }
  }

  const observer = new MutationObserver(reconcile);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', reconcile);
  window.addEventListener('pageshow', reconcile);
  window.navigation?.addEventListener('currententrychange', reconcile);
  window.setInterval(reconcile, 150);
  reconcile();

  function startArchive(root, signal) {

    const SHEET_ID = '16RVzVk3Pd1cThrvdJitHbhHBr4htzHCe2unNKfEXr4I';
    const SHEET_NAME = '자료목록';
    const CATEGORY_ORDER = ['전체','CAM','ROBOT','HYPER','TUNER','산업별 제안서','사용자 가이드'];
    const REQUIRED = ['ID','노출','상단고정','카테고리','제품','제목','한줄 설명','형식','다운로드 URL','게시글 URL','썸네일 URL','정렬'];
    const featureGrid = root.querySelector('#ea-feature-grid');
    const cardGrid = root.querySelector('#ea-card-grid');
    const tabs = root.querySelector('#ea-tabs');
    const results = root.querySelector('#ea-results');
    const message = root.querySelector('#ea-message');
    const search = root.querySelector('#ea-search');
    const searchForm = search.form;
    let query = '';
    const featureSection = root.querySelector('#ea-featured-section');
    const product = root.querySelector('#ea-product');
    const reset = root.querySelector('#ea-reset');
    let rows = [];
    const ordinaryRows = () => rows.filter((item) => !item.pinned)
      .sort((a, b) => b.registeredOn - a.registeredOn);

    function renderProducts(items) {
      const selected = product.value;
      const names = [...new Set(items.map((item) => item.product).filter(Boolean))];
      product.replaceChildren(new Option('전체 제품', ''), ...names.map((name) => new Option(name, name)));
      if (names.includes(selected)) product.value = selected;
    }
    let activeCategory = '전체';

    // 따옴표 내부 쉼표, 줄바꿈, 이중 따옴표를 처리하는 CSV 파서입니다.
    function parseCSV(source) {
      const text = source.replace(/^\uFEFF/, '');
      const table = []; let row = []; let field = ''; let quoted = false;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (quoted) {
          if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
          else if (char === '"') quoted = false;
          else field += char;
        } else if (char === '"' && field === '') quoted = true;
        else if (char === ',') { row.push(field); field = ''; }
        else if (char === '\n' || char === '\r') {
          if (char === '\r' && text[i + 1] === '\n') i++;
          row.push(field); table.push(row); row = []; field = '';
        } else field += char;
      }
      if (quoted) throw new Error('CSV 따옴표 형식 오류');
      if (row.length || field !== '') { row.push(field); table.push(row); }
      return table;
    }

    function registrationDate(value) {
      const match = /^(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})\.?$/.exec(value);
      if (!match) return 0;
      const [, year, month, day] = match.map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return 0;
      return year * 10000 + month * 100 + day;
    }

    // 순서가 변경되어도 헤더명을 기준으로 정확한 열을 찾습니다.
    function fromCSV(csv) {
      const grid = parseCSV(csv);
      if (!grid.length) throw new Error('빈 시트');
      const headers = grid[0].map((v) => v.trim());
      const missing = REQUIRED.filter((name) => !headers.includes(name));
      if (missing.length) throw new Error('필수 헤더 누락: ' + missing.join(', '));
      const index = Object.fromEntries(headers.map((h, i) => [h, i]));
      return grid.slice(1).map((cells) => {
        const get = (name) => String(cells[index[name]] ?? '').trim();
        return {
          id:get('ID'), visible:get('노출').toUpperCase() === 'Y',
          pinned:get('상단고정').toUpperCase() === 'Y',
          category:get('카테고리'), product:get('제품'),
          title:get('제목'), description:get('한줄 설명'), format:get('형식'),
          download:get('다운로드 URL'), post:get('게시글 URL'),
          thumbnail:get('썸네일 URL'), sort:Number(get('정렬')),
          registeredOn:registrationDate(get('등록일'))
        };
      }).filter((item) => item.visible && item.title)
        .sort((a,b) => (Number.isFinite(a.sort) ? a.sort : Infinity) - (Number.isFinite(b.sort) ? b.sort : Infinity));
    }

    function safeURL(input) {
      try {
        const url = new URL(input);
        return ['https:','http:'].includes(url.protocol) ? url.href : '';
      } catch { return ''; }
    }

    // Drive 파일 보기 링크만 직접 다운로드 주소로 변환합니다.
    function downloadURL(input) {
      const url = safeURL(input);
      if (!url) return '';
      const parsed = new URL(url);
      if (parsed.hostname === 'drive.google.com') {
        const match = parsed.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)\/view\/?$/);
        if (match) return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(match[1]);
      }
      return url;
    }

    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function badge(product) { return el('span','ea-badge',product || 'ENCY'); }
    function downloadIcon() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none'); svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','2'); svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round'); svg.setAttribute('aria-hidden','true');
      svg.innerHTML = '<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>';
      return svg;
    }
    function renderFeatured(items) {
      featureGrid.replaceChildren();
      featureSection.hidden = items.length === 0;
      items.forEach((item) => {
        const card = el('article','ea-feature-card');
        card.append(badge(item.product),el('h3','',item.title),el('p','',item.description));
        const href = downloadURL(item.download);
        const button = el(href ? 'a' : 'span',href ? 'ea-download' : 'ea-download ea-download-disabled',href ? 'PDF 다운로드' : '다운로드 준비 중');
        if (href) { button.href = href; button.target = '_blank'; button.rel = 'noopener'; button.setAttribute('aria-label',item.title + ' PDF 다운로드'); }
        button.prepend(downloadIcon());card.append(button);featureGrid.append(card);
      });
    }
    function fallback(title) { return el('div','ea-thumb ea-thumb-fallback',title); }
    function card(item) {
      const url = safeURL(item.post);
      const link = el(url ? 'a' : 'article','ea-card');
      if (url) { link.href = formURL(url); link.target = '_top'; link.setAttribute('aria-label',item.title + ' 게시글 보기'); }
      const picture = el('div','ea-thumb');
      const imageURL = safeURL(item.thumbnail);
      if (imageURL) {
        const img = document.createElement('img');
        img.src = imageURL; img.alt = item.title; img.loading = 'lazy'; img.decoding = 'async';
        img.addEventListener('error',() => picture.replaceWith(fallback(item.title)), {once:true});
        picture.append(img);
      } else picture.append(el('span','',item.title));
      if (!imageURL) picture.classList.add('ea-thumb-fallback');
      const body = el('div','ea-card-body');
      body.append(badge(item.product),el('h3','',item.title),el('p','',item.description));
      link.append(picture,body);return link;
    }
    function renderTabs(items) {
      const categories = new Set(items.map((item) => item.category));
      const list = CATEGORY_ORDER.filter((category) => category === '전체' || categories.has(category));
      if (activeCategory !== '전체' && !list.includes(activeCategory)) activeCategory = '전체';
      tabs.replaceChildren();
      list.forEach((category) => {
        const btn = el('button','ea-tab',category);
        btn.type = 'button';btn.setAttribute('role','tab');
        btn.setAttribute('aria-selected',String(category === activeCategory));
        btn.addEventListener('click',() => { activeCategory = category; renderTabs(items); renderCards(items); });
        tabs.append(btn);
      });
    }
    function renderCards(items) {
      const visible = items.filter((item) => (activeCategory === '전체' || item.category === activeCategory) && (!product.value || item.product === product.value) && (!query || (item.title + ' ' + item.description).toLocaleLowerCase('ko-KR').includes(query)));
      results.textContent = '총 ' + visible.length + '개 자료';
      message.hidden = true; cardGrid.replaceChildren();
      if (!visible.length) {
        message.className = 'ea-empty';message.textContent = '조건에 맞는 자료가 없습니다.';message.hidden = false;return;
      }
      const fragment = document.createDocumentFragment();visible.forEach((item) => fragment.append(card(item)));cardGrid.append(fragment);
    }
    function skeleton(image) {
      const holder = el('div','ea-skeleton');
      if (image) holder.append(el('div','ea-sk-image'));
      holder.append(el('div','ea-sk-line short'),el('div','ea-sk-line'),el('div','ea-sk-line medium'));
      return holder;
    }
    function loading() {
      featureSection.hidden = false;featureGrid.replaceChildren(...Array.from({length:4},()=>skeleton(false)));
      cardGrid.replaceChildren(...Array.from({length:6},()=>skeleton(true)));
      tabs.replaceChildren();results.textContent = '자료를 불러오는 중입니다.';message.hidden = true;
    }
    function showError() {
      featureGrid.replaceChildren();featureSection.hidden = true;
      cardGrid.replaceChildren();tabs.replaceChildren();results.textContent = '';
      message.className = 'ea-error';message.replaceChildren();
      message.append(el('p','', '자료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
      const retry = el('button','ea-retry','다시 시도');retry.type = 'button';retry.addEventListener('click',load);
      message.append(retry);message.hidden = false;
    }
    async function load() {
      loading();
      product.disabled = reset.disabled = true;
      const endpoint = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(SHEET_ID) + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(SHEET_NAME) + '&_=' + Date.now();
      try {
        const response = await fetch(endpoint,{cache:'no-store', signal});
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const csv = await response.text();
        if (signal.aborted) return;
        rows = fromCSV(csv);
        const ordinary = rows.filter((item) => !item.pinned);
        renderFeatured(rows.filter((item) => item.pinned));renderTabs(ordinary);renderProducts(ordinary);renderCards(ordinary);
        product.disabled = reset.disabled = false;
      } catch (error) { if (signal.aborted) return; console.error('[ENCY 자료실] 데이터 불러오기 실패:',error);showError(); }
    }
    const applyFilters = () => { if (!product.disabled) renderCards(ordinaryRows()); };
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      query = search.value.trim().toLocaleLowerCase('ko-KR');
      applyFilters();
    }, { signal });
    product.addEventListener('change', applyFilters, { signal });
    reset.addEventListener('click', () => {
      activeCategory = '전체';
      product.value = search.value = query = '';
      renderTabs(ordinaryRows());
      applyFilters();
    }, { signal });
    load();
  }
})();
