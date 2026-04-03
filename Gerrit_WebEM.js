// ==UserScript==
// @name         Gerrit
// @namespace    http://tampermonkey.net/
// @version      1.11
// @author       Frank Wu
// @include  https://gerrit.ext.net.nokia.com/*
// @require  http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant GM_addStyle

// ==/UserScript==

(function () {
  'use strict';
  console.log('%c[Gerrit TM] Script loaded v1.10', 'color:green;font-weight:bold;font-size:14px');

  // ─── Shadow DOM helpers ────────────────────────────────────────────────────
  // Gerrit 3.9 uses Lit with Declarative Shadow DOM. The gr-* component
  // internals live in shadow roots; these helpers walk the tree recursively.

  function deepQuery(root, selector) {
    try {
      const hit = root.querySelector(selector);
      if (hit) return hit;
    } catch (_) {}
    for (const el of root.querySelectorAll('*')) {
      if (!el.shadowRoot) continue;
      const found = deepQuery(el.shadowRoot, selector);
      if (found) return found;
    }
    return null;
  }

  function deepQueryAll(root, selector) {
    const results = [];
    try { results.push(...root.querySelectorAll(selector)); } catch (_) {}
    for (const el of root.querySelectorAll('*')) {
      if (!el.shadowRoot) continue;
      results.push(...deepQueryAll(el.shadowRoot, selector));
    }
    return results;
  }

  // ─── URL-based page detection ──────────────────────────────────────────────

  function isDetailPage() {
    return /\/gerrit\/c\/.+\/\+\/\d+/.test(location.href);
  }

  function isDashboardPage() {
    return /\/gerrit\/(q\/|dashboard)/.test(location.href);
  }

  // ─── Interval handles ─────────────────────────────────────────────────────

  let lastUrl = location.href;
  let tryToAddButtons$ = null;
  let tryToAddCopyPathButtons$ = null;
  let tryToAddDashboardDirectLinks$ = null;
  let dashboardScheduled = false;
  let addedLinks = [];
  let addedRetryButton = [];

  // ── URL polling: detects SPA navigation (pushState / replaceState) ──────────
  setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    console.log('Gerrit SPA nav:', location.href);
    onPageChange();
  }, 500);

  function resetDetailIntervals() {
    clearInterval(tryToAddButtons$);      tryToAddButtons$ = null;
    clearInterval(tryToAddCopyPathButtons$); tryToAddCopyPathButtons$ = null;
  }

  function resetDashboardIntervals() {
    clearInterval(tryToAddDashboardDirectLinks$); tryToAddDashboardDirectLinks$ = null;
    dashboardScheduled = false;
  }

  function startDetailPolling() {
    if (tryToAddButtons$) return;
    console.log('Gerrit: starting detail page polling');
    tryToAddButtons$ = setInterval(tryToAddButtons, 1000);
    tryToAddCopyPathButtons$ = setInterval(tryToAddCopyPathButtons, 1000);
  }

  function startDashboardPolling() {
    if (dashboardScheduled) return;
    dashboardScheduled = true;
    console.log('Gerrit: scheduling dashboard polling');
    setTimeout(tryToAddDashboardDirectLinks, 2000);
    tryToAddDashboardDirectLinks$ = setInterval(tryToAddDashboardDirectLinks, 600000);
  }

  function onPageChange() {
    resetDetailIntervals();
    resetDashboardIntervals();

    if (isDetailPage())   startDetailPolling();
    if (isDashboardPage()) startDashboardPolling();
  }

  // ── MutationObserver: catches element appearing in DOM after initial render ──
  const _observer = new MutationObserver(() => {
    if (isDashboardPage() && !dashboardScheduled && document.querySelector('gr-change-list-item')) {
      console.log('observer: gr-change-list-item appeared');
      startDashboardPolling();
    }
    if (isDetailPage() && !tryToAddButtons$ && document.querySelector('gr-change-view')) {
      console.log('observer: gr-change-view appeared');
      startDetailPolling();
    }
  });
  _observer.observe(document.documentElement, { childList: true, subtree: true });

  // Fire once for the page already loaded when the script starts
  setTimeout(onPageChange, 500);

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD PAGE  – verification pipeline links + RECHECK buttons
  // ═══════════════════════════════════════════════════════════════════════════

  function tryToAddDashboardDirectLinks() {
    const MAX_ITEMS = 6;
    console.log('tryToAddDashboardDirectLinks');

    async function execute() {
      const list = findChangeListItems();
      if (!list.length) { console.log('no cr list rendered yet'); return; }

      console.log(`${list.length} cr items found`);
      addedLinks.forEach(e => e.remove());       addedLinks = [];
      addedRetryButton.forEach(e => e.remove()); addedRetryButton = [];

      const d = new Date();
      const ts = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;

      for (const { linkA, statusTd, project } of list) {
        const href = linkA.getAttribute('href').replace(/\?.*$/, '');
        const crlink = window.location.origin + href;

        const detail = await getCrLinkDetail(crlink, project);
        if (!detail.verLink) continue;

        // ── pipeline status link ──
        const a = document.createElement('a');
        a.style.marginRight = '10px';
        let icon = 'Ongoing';
        if (detail.verStatus === 0)  { a.className = 'spinner'; }
        if (detail.verStatus === 1)  { icon = '✔'; a.className = 'u-green'; }
        if (detail.verStatus <= -1)  { icon = '❌'; a.className = 'u-red'; }
        a.innerHTML = `${icon}(${ts})`;
        a.href = detail.verLink;
        a.target = '_blank';
        statusTd.prepend(a);
        addedLinks.push(a);

        // ── RECHECK button ──
        const btn = document.createElement('button');
        btn.textContent = 'RECHECK';
        btn.style.marginRight = '10px';
        btn.onclick = () => sendRecheckMessage({
          _number: detail._number,
          _revision_number: detail._revision_number,
          msg: 'RECHECK',
          project,
        });
        statusTd.prepend(btn);
        addedRetryButton.push(btn);
      }

      console.log(`${list.length} items processed`);
    }

    execute();

    // ── helpers ──────────────────────────────────────────────────────────────

    function findChangeListItems() {
      // Gerrit 3.9: gr-change-list-item is in the regular DOM;
      // its cells (td.cell.*) are inside its declarative shadow root.
      const rawItems = document.querySelectorAll('gr-change-list-item');
      console.log(`[Gerrit TM] gr-change-list-item count: ${rawItems.length}`);

      const mapped = [...rawItems].map((item, i) => {
        const sr = item.shadowRoot || item;
        console.log(`[Gerrit TM] item[${i}] shadowRoot:`, !!item.shadowRoot);

        const linkA    = sr.querySelector('td.cell.subject a') || sr.querySelector('td.subject a');
        const statusTd = sr.querySelector('td.cell.status')    || sr.querySelector('td.status');
        const repoEl   = sr.querySelector('td.cell.repo a.truncatedRepo') ||
                         sr.querySelector('td.cell.repo a.fullRepo') ||
                         sr.querySelector('td.repo a.truncatedRepo');
        const project  = repoEl?.title?.trim() || repoEl?.textContent?.trim();
        console.log(`[Gerrit TM] item[${i}] linkA:${!!linkA} statusTd:${!!statusTd} project:${project}`);
        return { linkA, statusTd, project };
      });

      const filtered = mapped.filter(x => x.linkA && x.statusTd && x.project);
      console.log(`[Gerrit TM] valid items: ${filtered.length}`);
      return filtered.slice(0, MAX_ITEMS);
    }

    async function getCrLinkDetail(crlink, project) {
      const changeId = crlink.split('/').pop();
      const url = `${location.origin}/gerrit/changes/${encodeURIComponent(project)}~${changeId}/detail`;
      let text;
      try { text = await fetch(url).then(r => r.text()); } catch (_) { return {}; }

      // Gerrit REST API prepends ")]}'\\n" – strip it.
      const json = text.split('\n').slice(1).join('');
      if (!json) return {};

      let data;
      try { data = JSON.parse(json); } catch (_) { return {}; }

      const startMsgs = (data.messages || []).filter(m => m.message.includes('Starting VERIFICATION:'));
      if (!startMsgs.length) return {};

      const _revision_number = [...(data.messages || [])]
        .sort((a, b) => b._revision_number - a._revision_number)[0]._revision_number;

      const verLink = startMsgs[startMsgs.length - 1].message
        .split('Starting VERIFICATION:').pop().trim();

      const pplVerified = data.labels?.Verified?.all?.find(x => x.username === 'ca_psscm');
      let verStatus = pplVerified?.value ?? 0;
      if (pplVerified && data.labels.Verified.approved)  verStatus = 1;
      if (pplVerified && data.labels.Verified.rejected)  verStatus = -1;

      return { verLink, verStatus, _number: data._number, _revision_number };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETAIL PAGE  – pipeline links, RECHECK buttons, fetch/download helpers
  // ═══════════════════════════════════════════════════════════════════════════

  function tryToAddButtons() {
    console.log('tryToAddButtons');

    // Wait for gr-messages-list (lives inside gr-change-view shadow root)
    // and for gr-download-dialog (also inside gr-change-view shadow root).
    const changeView = document.querySelector('gr-change-view');
    if (!changeView?.shadowRoot) return;
    const cvSr = changeView.shadowRoot;

    const messagesList = cvSr.querySelector('gr-messages-list');
    if (!messagesList) return;

    const messages = deepQueryAll(messagesList, 'gr-message');
    if (!messages.length) return;

    // gr-download-dialog is only shown when the download panel is open,
    // but the element itself is always in the DOM (#downloadDialog).
    const downloadDialog = cvSr.querySelector('#downloadDialog, gr-download-dialog');
    if (!downloadDialog) return;

    createPipeLineLinks(messages);
    createRetryButtons(changeView);
    createFetchButtons(downloadDialog, cvSr);
    clearInterval(tryToAddButtons$);
  }

  // ── File-copy buttons ──────────────────────────────────────────────────────

  function tryToAddCopyPathButtons() {
    console.log('tryToAddCopyPathButtons');
    if (deepQuery(document, 'button[name="copyFilePath"]')) {
      clearInterval(tryToAddCopyPathButtons$);
      return;
    }
    const fileListEl = deepQuery(document, 'gr-file-list');
    if (!fileListEl) return;

    createCopyPathButtons(fileListEl);
    clearInterval(tryToAddCopyPathButtons$);
  }

  function createCopyPathButtons(fileListEl) {
    // gr-file-list renders file rows; each row has an <a> with the file path.
    // In Gerrit 3.9 the file links are inside gr-file-list-item shadow roots.
    const fileItems = deepQueryAll(fileListEl, 'gr-file-list-item, .file-row');
    if (fileItems.length) {
      fileItems.forEach((row, idx) => {
        if (idx === 0) return; // skip the "Commit message" pseudo-row
        const pathEl = deepQuery(row, 'a[href*="diff"], .path, .fullFileName');
        if (!pathEl) return;
        const getPath = () =>
          pathEl.getAttribute('title') ||
          pathEl.dataset.value ||
          pathEl.textContent.trim();
        addCopyButton(pathEl.closest('td, div') || pathEl, getPath);
      });
      return;
    }
    // Fallback: find all diff links in the file list shadow
    const sr = fileListEl.shadowRoot || fileListEl;
    const links = sr.querySelectorAll('a[href*="diff"]');
    [...links].forEach((link, idx) => {
      if (idx === 0) return;
      addCopyButton(link.parentElement || link,
        () => link.pathname?.split('/').pop() || link.textContent.trim());
    });
  }

  function addCopyButton(container, getPath) {
    if (container.querySelector('button[name="copyFilePath"]')) return;
    const btn = document.createElement('button');
    btn.textContent = 'Copy File Path';
    btn.setAttribute('name', 'copyFilePath');
    btn.addEventListener('click', e => {
      e.preventDefault();
      navigator.clipboard.writeText(getPath());
    }, true);
    container.appendChild(btn);
  }

  // ── Pipeline links inside message banners ──────────────────────────────────
  // gr-message shadow root structure (Gerrit 3.9):
  //   div.collapsed | div.expanded
  //     div.contentContainer
  //       div.content.messageContent
  //         div.message         ← collapsed preview text
  //         div.message.hideOnCollapsed  ← expanded full text

  function createPipeLineLinks(messages) {
    messages.forEach(msg => {
      const sr = msg.shadowRoot || msg;
      // Already has our link?
      if (sr.querySelector('a[data-pipeline-link]')) return;

      // Find the text container that holds the VERIFICATION URL
      const textEl = sr.querySelector('.contentContainer .message') ||
                     sr.querySelector('.contentContainer') ||
                     sr.querySelector('div');
      if (!textEl) return;

      const text = textEl.innerText || textEl.textContent || '';
      const httpsIdx = text.indexOf('https://');
      if (httpsIdx < 0) return;

      // Grab the URL (stop at first whitespace/newline)
      const urlPart = text.slice(httpsIdx).replace(/\s[\s\S]*/, '');
      const pipelineMatch = urlPart.match(/jenkins\/(.+?)\/detail/);
      if (!pipelineMatch) return;

      const project = pipelineMatch[1];
      const runId = urlPart.split('/').pop();
      const logUrl = `https://oam-cci.oam.scm.nsn-rdnet.net/blue/rest/organizations/jenkins/pipelines/${project}/runs/${runId}/log/?`;

      const a = document.createElement('a');
      a.href = logUrl;
      a.target = '_blank';
      a.textContent = 'pipeline log';
      a.dataset.pipelineLink = '1';
      a.style.marginLeft = '8px';

      // Append after the text block, inside the contentContainer
      const container = sr.querySelector('.contentContainer') || sr;
      container.appendChild(a);
      console.log('pipeline link appended');
    });
  }

  // ── RECHECK / RECHECK_ALL / RECHECK_PIT buttons ───────────────────────────

  function createRetryButtons(changeView) {
    const project = getProjectFromUrl();
    if (!project) return;

    // gr-messages-list is in changeView shadow root – append buttons there
    // so they appear at the bottom of the messages panel.
    const msgList = changeView.shadowRoot.querySelector('gr-messages-list');
    if (!msgList) return;

    ['RECHECK_ALL', 'RECHECK_PIT', 'RECHECK'].forEach(text => {
      if (msgList.querySelector(`button[data-recheck="${text}"]`)) return;
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.style.marginLeft = '20px';
      btn.dataset.recheck = text;
      btn.onclick = () => sendRetryMessage(text, project);
      msgList.appendChild(btn);
      console.log(`retry button created: ${text}`);
    });
  }

  function sendRetryMessage(msg, project) {
    const _number = location.href.split('+/')[1]?.split('/')[0];
    if (!_number) return;
    const _revision_number = getPatchNum();
    sendRecheckMessage({ _number, _revision_number, msg, project });
  }

  function getPatchNum() {
    // Try to read from gr-change-view JS property (most reliable).
    const cv = document.querySelector('gr-change-view');
    if (cv?.patchNum !== undefined) return String(cv.patchNum);

    // URL: /gerrit/c/<project>/+/<changeNum>/<patchNum>
    const after = location.pathname.split('+/')[1];
    if (after) {
      const parts = after.split('/').filter(Boolean);
      if (parts.length >= 2) return parts[1];
    }
    return '1';
  }

  function getProjectFromUrl() {
    // URL pattern: /gerrit/c/<project>/+/<number>
    const m = location.pathname.match(/\/gerrit\/c\/(.+)\/\+\/\d+/);
    return m ? m[1] : null;
  }

  function sendRecheckMessage({ _number, _revision_number, msg, project }) {
    const url = `${location.origin}/gerrit/changes/${encodeURIComponent(project)}~${_number}/revisions/${_revision_number}/review`;
    const xsrfCookie = document.cookie.split(';').find(p => p.trim().startsWith('XSRF_TOKEN'));
    const XSRF_TOKEN = xsrfCookie?.split('=')[1];
    fetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'accept': '*/*',
        'content-type': 'application/json',
        'x-gerrit-auth': XSRF_TOKEN,
      },
      body: JSON.stringify({ drafts: 'PUBLISH_ALL_REVISIONS', labels: {}, message: msg, reviewers: [] }),
    }).then(resp => {
      if (!resp.ok) { console.error(`Failed to send ${msg}`, resp); return; }
      if (confirm(`Successfully sent "${msg}". Reload page?`)) location.reload();
    });
  }

  // ── "Copy fetch command" + artifact download links ─────────────────────────
  // Gerrit 3.9 structure (all inside shadow roots):
  //   gr-change-view#shadow  →  #downloadDialog (gr-download-dialog)
  //     gr-download-dialog#shadow  →  #downloadCommands (gr-download-commands)
  //       gr-download-commands#shadow  →  gr-shell-command.checkout (or any)
  //         gr-shell-command#shadow  →  gr-copy-clipboard
  //           gr-copy-clipboard#shadow  →  iron-input  →  input#input  (.value = git cmd)

  function createFetchButtons(downloadDialog, cvSr) {
    if (cvSr.querySelector('button[data-fetch-btn]')) return;

    // Find any input whose value looks like a git fetch command
    const fetchInput = deepQuery(downloadDialog, 'input#input') ||
                       deepQuery(downloadDialog, 'input[value*="git fetch"]');
    if (!fetchInput) return;

    const cmd = fetchInput.value;
    if (!cmd.includes('refs/changes/')) return;

    const fetchPart = cmd.split('&&')[0].trim();

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy: git fetch + log';
    copyBtn.dataset.fetchBtn = '1';
    copyBtn.style.cssText = 'margin:4px 4px 4px 0';
    copyBtn.addEventListener('click', e => {
      e.preventDefault();
      navigator.clipboard.writeText(fetchPart + ' && git log FETCH_HEAD -1');
    }, true);

    // Parse change/patch numbers from the refs/changes/<xx>/<change>/<patch> path
    const refsMatch = cmd.match(/refs\/changes\/\d+\/(\d+)\/(\d+)/);
    if (!refsMatch) return;
    const [, change, patch] = refsMatch;

    const downloadLinks = createArtifactLinks(change, patch);

    // Attach near the commit message area (inside gr-change-view shadow root)
    const commitMsg = cvSr.querySelector('#commitMessage, .commitMessage');
    const anchor = commitMsg?.parentElement || cvSr;
    anchor.appendChild(copyBtn);
    downloadLinks.forEach(l => anchor.appendChild(l));
  }

  function createArtifactLinks(change, patch) {
    return ['VDU', 'CU'].map(type => {
      const subDir = type === 'CU' ? 'rcp' : 'rcp_oam';
      const url = `https://artifactory-espoo1.int.net.nokia.com/artifactory/list/japco-local/sc-build-artifacts/oam-cci/MN_MANO_OAMCU_WEBEM_webem/master/VERIFICATION/${change}_${patch}/BUILD_${type}/WEBEM/${subDir}/webem-${type}.staging.txz`;
      const filename = `${change}_${patch}_${type}_webem.staging.txz`;
      const a = document.createElement('a');
      Object.assign(a, { download: filename, href: url, innerText: filename });
      a.style.cssText = 'margin:4px 8px 4px 0; display:inline-block';
      return a;
    });
  }

  // ─── CSS ───────────────────────────────────────────────────────────────────

  GM_addStyle(`
@keyframes spinner { to { transform: rotate(360deg); } }
.spinner:before {
  vertical-align: text-bottom;
  content: '';
  display: inline-block;
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  margin-top: -10px;
  margin-left: -10px;
  border-radius: 50%;
  border: 2px solid #ccc;
  border-top-color: #000;
  animation: spinner 1s linear infinite;
}
`);

})();
