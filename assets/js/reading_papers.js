/**
 * Reading list page: keyword filter, local add, export YAML
 */
(function () {
  var STORAGE_KEY = 'reading_papers_local';

  function getLocalPapers() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setLocalPapers(papers) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(papers));
  }

  function canonicalUrl(u) {
    if (!u) return '';
    var x = u.replace(/#.*$/, '').replace(/\/+$/, '');
    var m = x.match(/ieeexplore\.ieee\.org\/document\/(\d+)/i);
    if (m) return 'https://ieeexplore.ieee.org/document/' + m[1];
    m = x.match(/ieeexplore\.ieee\.org\/abstract\/document\/(\d+)/i);
    if (m) return 'https://ieeexplore.ieee.org/document/' + m[1];
    m = x.match(/arxiv\.org\/(?:pdf|abs)\/(\d+\.\d+)(?:v\d+)?/i);
    if (m) return 'https://arxiv.org/abs/' + m[1];
    m = x.match(/dl\.acm\.org\/doi\/([^/?]+)/i);
    if (m) return 'https://dl.acm.org/doi/' + m[1];
    m = x.match(/link\.springer\.com\/(article|chapter)\/([^/?]+)/i);
    if (m) return 'https://link.springer.com/' + m[1] + '/' + m[2];
    m = x.match(/sciencedirect\.com\/science\/article\/([^/?]+)/i);
    if (m) return 'https://www.sciencedirect.com/science/article/' + m[1];
    return x || u;
  }

  function isJunkTitle(title) {
    if (!title || title.length < 3) return true;
    var t = (title || '').trim();
    if (/^IEEE\s*Xplore\s*$/i.test(t)) return true;
    if (/^IEEE\s*Xplore\s*Login$/i.test(t)) return true;
    if (/^IEEE\s*Xplore\s*Full-Text\s*PDF/i.test(t)) return true;
    if (/^Sign\s*in$/i.test(t)) return true;
    if (/^Login$/i.test(t)) return true;
    if (/^arXiv\s+[\d.]+\s*$/i.test(t)) return true;
    return false;
  }

  function runDedup() {
    var local = getLocalPapers();
    if (!local.length) {
      var msg = document.getElementById('auto-record-msg');
      if (msg) { msg.textContent = 'No local papers to deduplicate.'; msg.style.display = 'block'; }
      return;
    }
    var byCanon = {};
    local.forEach(function (p) {
      var c = canonicalUrl(p.url);
      if (!c) c = (p.url || '').replace(/#.*$/, '').replace(/\/+$/, '') || p.url;
      if (!c) return;
      var title = (p.title || '').trim();
      var hasTitle = title && title !== '(No title)' && !isJunkTitle(title);
      if (!byCanon[c] || (hasTitle && (!byCanon[c].title || byCanon[c].title === '(No title)' || isJunkTitle(byCanon[c].title)))) {
        byCanon[c] = { title: title || '(No title)', url: c, date: p.date || '', keywords: p.keywords || [], notes: p.notes || '', abstract: p.abstract || '', citation: p.citation || null, citationText: p.citationText || '' };
      }
    });
    var out = Object.keys(byCanon).map(function (k) { return byCanon[k]; });
    out = out.filter(function (p) { return !isJunkTitle(p.title); });
    setLocalPapers(out);
    renderLocalPapers();
    updateKeywordPills();
    applyFilter();
    var msg = document.getElementById('auto-record-msg');
    if (msg) {
      var removed = local.length - out.length;
      msg.textContent = removed > 0 ? 'Removed ' + removed + ' duplicate/junk title(s). ' + out.length + ' paper(s) in list.' : 'No duplicates. ' + out.length + ' paper(s).';
      msg.style.display = 'block';
    }
  }

  function renderLocalPapers() {
    var list = document.getElementById('papers-from-storage-list');
    var wrapper = document.getElementById('papers-from-storage-wrapper');
    if (!list || !wrapper) return;

    var papers = getLocalPapers();
    if (papers.length === 0) {
      wrapper.style.display = 'none';
      return;
    }

    wrapper.style.display = 'block';
    var kwStr = function (p) { return (p.keywords || []).join(','); };
    list.innerHTML = papers.map(function (p, i) {
      var keywords = (p.keywords || []).map(function (k) {
        return '<span class="badge badge-light border mr-1">' + escapeHtml(k) + '</span>';
      }).join('');
      var abstractAttr = (p.abstract || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, ' ');
      var citationText = (p.citationText || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, ' ');
      return (
        '<div class="reading-paper-item border-bottom border-gray p-3" data-keywords="' +
        escapeHtml(kwStr(p)) +
        '" data-abstract="' + abstractAttr + '" data-citation-text="' + citationText + '" data-source="local" data-local-index="' + i + '">' +
        '<div class="d-flex justify-content-between align-items-start flex-wrap">' +
        '<div class="flex-grow-1">' +
        '<h5 class="mt-0 mb-1 font-weight-normal">' +
        '<span class="badge badge-secondary mr-1" title="Stored on this device only">Local</span>' +
        '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener">' + escapeHtml(p.title) + '</a>' +
        '</h5>' +
        '<p class="mb-1 small text-muted">' +
        '<span class="mr-2"><i class="far fa-calendar-alt mr-1"></i>' + escapeHtml(p.date || '') + '</span>' +
        (p.notes ? '<span><i class="far fa-sticky-note mr-1"></i>' + escapeHtml(p.notes) + '</span>' : '') +
        '</p>' +
        (p.citationText ? '<p class="mb-1 small text-muted"><i class="fas fa-quote-right mr-1"></i>' + escapeHtml(p.citationText) + '</p>' : '') +
        '<div class="keyword-tags">' + keywords + '</div>' +
        '<div class="mt-2 local-edit-keywords" style="display:none;">' +
        '<input type="text" class="form-control form-control-sm d-inline-block mr-1" style="width:220px;" placeholder="Keywords, comma-separated" data-edit-keywords>' +
        '<button type="button" class="btn btn-sm btn-success btn-save-keywords" data-index="' + i + '">Save</button>' +
        '</div>' +
        '</div>' +
        '<div>' +
        '<button type="button" class="btn btn-sm btn-outline-secondary ml-1 btn-edit-keywords" data-index="' + i + '" title="Add or edit keywords so this paper appears when filtering">Edit keywords</button> ' +
        '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary ml-2">Open</a> ' +
        '<button type="button" class="btn btn-sm btn-outline-danger ml-1 btn-remove-local" data-index="' + i + '">Remove</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    list.querySelectorAll('.btn-remove-local').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        var papers = getLocalPapers();
        papers.splice(idx, 1);
        setLocalPapers(papers);
        renderLocalPapers();
        updateKeywordPills();
        applyFilter();
      });
    });

    list.querySelectorAll('.btn-edit-keywords').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.reading-paper-item');
        var editDiv = row ? row.querySelector('.local-edit-keywords') : null;
        var input = row ? row.querySelector('[data-edit-keywords]') : null;
        if (!editDiv || !input) return;
        var papers = getLocalPapers();
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        if (idx < 0 || idx >= papers.length) return;
        input.value = (papers[idx].keywords || []).join(', ');
        editDiv.style.display = 'block';
        input.focus();
      });
    });

    list.querySelectorAll('.btn-save-keywords').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.reading-paper-item');
        var editDiv = row ? row.querySelector('.local-edit-keywords') : null;
        var input = row ? row.querySelector('[data-edit-keywords]') : null;
        if (!editDiv || !input) return;
        var papers = getLocalPapers();
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        if (idx < 0 || idx >= papers.length) return;
        var val = (input.value || '').trim();
        papers[idx].keywords = val ? val.split(/[,，]/).map(function (k) { return k.trim(); }).filter(Boolean) : [];
        setLocalPapers(papers);
        renderLocalPapers();
        updateKeywordPills();
        applyFilter();
        editDiv.style.display = 'none';
      });
    });
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function getAllPaperItems() {
    var fromData = document.getElementById('papers-from-data');
    var fromList = document.getElementById('papers-from-storage-list');
    var items = [];
    if (fromData) items = items.concat([].slice.call(fromData.querySelectorAll('.reading-paper-item')));
    if (fromList) items = items.concat([].slice.call(fromList.querySelectorAll('.reading-paper-item')));
    return items;
  }

  function getTitleFromPaperItem(el) {
    var link = el.querySelector('h5 a') || el.querySelector('.flex-grow-1 a');
    return link ? (link.textContent || '').trim() : '';
  }

  function getSelectedKeywords() {
    var pills = document.querySelectorAll('.keyword-filter.active');
    var keywords = [];
    for (var i = 0; i < pills.length; i++) {
      var k = (pills[i].getAttribute('data-keyword') || '').trim();
      if (k && k !== '*') keywords.push(k);
    }
    return keywords;
  }

  function applyFilter() {
    var searchInput = document.getElementById('filter-by-abstract');
    var searchText = (searchInput && searchInput.value) ? searchInput.value.trim() : '';
    var selectedKeywords = getSelectedKeywords();
    var useSearchBox = searchText.length > 0;
    var showAll = !useSearchBox && selectedKeywords.length === 0;
    getAllPaperItems().forEach(function (el) {
      var abstractText = (el.getAttribute('data-abstract') || '').toLowerCase();
      var titleText = getTitleFromPaperItem(el).toLowerCase();
      var kw = parseKeywordsFromEl(el);
      var match;
      if (showAll) {
        match = true;
      } else if (useSearchBox) {
        var keywordLower = searchText.toLowerCase();
        match = abstractText.indexOf(keywordLower) !== -1 || titleText.indexOf(keywordLower) !== -1 || kw.some(function (k) { return k.toLowerCase() === keywordLower; });
      } else {
        match = selectedKeywords.some(function (keyword) {
          var keywordLower = keyword.toLowerCase();
          return abstractText.indexOf(keywordLower) !== -1 || titleText.indexOf(keywordLower) !== -1 || kw.some(function (k) { return k.toLowerCase() === keywordLower; });
        });
      }
      el.style.display = match ? '' : 'none';
    });
    var wrapper = document.getElementById('papers-from-storage-wrapper');
    if (wrapper) {
      var list = document.getElementById('papers-from-storage-list');
      var localItems = list ? list.querySelectorAll('.reading-paper-item') : [];
      var anyVisible = false;
      for (var i = 0; i < localItems.length; i++) {
        if (localItems[i].style.display !== 'none') { anyVisible = true; break; }
      }
      if (localItems.length > 0) wrapper.style.display = anyVisible ? 'block' : 'none';
    }
  }

  function parseKeywordsFromEl(el) {
    var kwStr = (el.getAttribute('data-keywords') || '').trim();
    if (!kwStr) return [];
    return kwStr.split(/[,，]/).map(function (k) { return k.trim(); }).filter(Boolean);
  }

  var ABSTRACT_STOPWORDS = {
    the: 1, and: 1, for: 1, are: 1, but: 1, not: 1, you: 1, all: 1, can: 1, had: 1, her: 1, was: 1, one: 1, our: 1, out: 1,
    has: 1, have: 1, this: 1, that: 1, with: 1, from: 1, they: 1, been: 1, were: 1, will: 1, would: 1, could: 1, should: 1,
    may: 1, might: 1, its: 1, into: 1, than: 1, then: 1, when: 1, which: 1, while: 1, where: 1, what: 1, them: 1, their: 1,
    there: 1, these: 1, those: 1, each: 1, other: 1, some: 1, such: 1, only: 1, more: 1, most: 1, also: 1, over: 1, after: 1,
    before: 1, between: 1, through: 1, during: 1, without: 1, same: 1, both: 1, about: 1, based: 1, using: 1, used: 1,
    results: 1, result: 1, paper: 1, study: 1, method: 1, methods: 1, approach: 1, system: 1, systems: 1, data: 1,
    model: 1, models: 1, proposed: 1, show: 1, shown: 1, present: 1, presented: 1, we: 1, use: 1
  };

  function extractWordsFromText(text) {
    if (!text || !text.length) return [];
    var words = text.replace(/[^\w\s'-]/g, ' ').split(/\s+/).map(function (w) { var x = (w || '').replace(/^['"]|['"]$/g, '').trim(); return x ? x.toLowerCase() : ''; }).filter(Boolean);
    return words;
  }

  /** Keywords from abstracts and titles: words length>=4, not stopword. Word must appear in at least minPapers (default 1 so title-only papers get pills). */
  function getAbstractDerivedKeywords(minPapers) {
    minPapers = minPapers != null ? minPapers : 1;
    var wordCount = {};
    getAllPaperItems().forEach(function (el) {
      var seenInThis = {};
      var abs = (el.getAttribute('data-abstract') || '').toLowerCase();
      extractWordsFromText(abs).forEach(function (w) {
        if (w.length < 4 || /^\d+$/.test(w) || ABSTRACT_STOPWORDS[w]) return;
        if (!seenInThis[w]) { seenInThis[w] = true; wordCount[w] = (wordCount[w] || 0) + 1; }
      });
      var title = getTitleFromPaperItem(el).toLowerCase();
      extractWordsFromText(title).forEach(function (w) {
        if (w.length < 4 || /^\d+$/.test(w) || ABSTRACT_STOPWORDS[w]) return;
        if (!seenInThis[w]) { seenInThis[w] = true; wordCount[w] = (wordCount[w] || 0) + 1; }
      });
    });
    var out = {};
    Object.keys(wordCount).forEach(function (w) {
      if (wordCount[w] >= minPapers) out[w] = true;
    });
    return out;
  }

  function updateKeywordPills() {
    var pillsContainer = document.getElementById('keyword-pills');
    if (!pillsContainer) return;

    var seen = {};
    getAllPaperItems().forEach(function (el) {
      parseKeywordsFromEl(el).forEach(function (k) { seen[k] = true; });
    });
    var fromAbstract = getAbstractDerivedKeywords(1);
    Object.keys(fromAbstract).forEach(function (k) { seen[k] = true; });

    var existing = {};
    pillsContainer.querySelectorAll('.keyword-filter').forEach(function (btn) {
      var k = btn.getAttribute('data-keyword');
      if (k) existing[k] = true;
    });

    Object.keys(seen).sort().forEach(function (k) {
      if (existing[k]) return;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline-primary btn-sm rounded-pill mr-1 mb-1 keyword-filter';
      btn.setAttribute('data-keyword', k);
      btn.textContent = k;
      btn.title = fromAbstract[k] ? 'From abstract (click to filter)' : '';
      pillsContainer.appendChild(btn);
    });
  }

  function onKeywordClick() {
    var isAll = !(this.getAttribute('data-keyword') || '').trim();
    var pillsContainer = document.getElementById('keyword-pills');
    if (isAll) {
      if (pillsContainer) pillsContainer.querySelectorAll('.keyword-filter').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
    } else {
      this.classList.toggle('active');
      if (pillsContainer) pillsContainer.querySelectorAll('.keyword-filter').forEach(function (b) {
        if (!(b.getAttribute('data-keyword') || '').trim()) b.classList.remove('active');
      });
    }
    applyFilter();
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** True if element is visible (not hidden by display). */
  function isVisible(el) {
    var style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  /** Get papers that are currently visible (after keyword filter). */
  function getVisiblePapers() {
    var items = getAllPaperItems();
    var papers = [];
    items.forEach(function (el) {
      if (!isVisible(el)) return;
      var link = el.querySelector('h5 a') || el.querySelector('.flex-grow-1 a');
      var title = link ? link.textContent.trim() : '';
      var url = link ? (link.getAttribute('href') || '') : '';
      var notes = '';
      var icon = el.querySelector('.fa-sticky-note');
      if (icon && icon.parentNode) notes = icon.parentNode.textContent.replace(/\s+/g, ' ').trim();
      var citationText = (el.getAttribute('data-citation-text') || '').trim();
      if (title) papers.push({ title: title, url: url, notes: notes, citationText: citationText });
    });
    return papers;
  }

  /** Build prompt text for LLM to generate Related Work. */
  function buildRelatedWorkPrompt(papers) {
    if (!papers.length) return '';
    var intro = 'Write a "Related Work" subsection for a research paper based on the following papers. ';
    intro += 'Use in-text citations [1], [2], etc. and list full references at the end. ';
    intro += 'Keep the narrative coherent and connect the works thematically.\n';
    intro += 'Prefer the full citation lines below when writing references.\n\nPapers:\n\n';
    var list = papers.map(function (p, i) {
      var line = '[' + (i + 1) + '] ' + (p.citationText || (p.title + '. ' + p.url));
      if (p.notes) line += '\n     (' + p.notes + ')';
      return line;
    }).join('\n\n');
    return intro + list;
  }

  function initRelatedWork() {
    var promptTa = document.getElementById('related-work-prompt');
    var btnCopyPrompt = document.getElementById('btn-copy-related-work-prompt');
    var btnOpenAI = document.getElementById('btn-generate-with-openai');
    var inputKey = document.getElementById('input-openai-key');
    var outputWrap = document.getElementById('related-work-output-wrap');
    var outputTa = document.getElementById('related-work-output');
    var btnCopyOutput = document.getElementById('btn-copy-related-work-output');

    document.body.addEventListener('click', function (e) {
      var btnFill = e.target.id === 'btn-fill-related-work-prompt' ? e.target : (e.target.closest && e.target.closest('#btn-fill-related-work-prompt'));
      if (!btnFill || !promptTa) return;
      var papers = getVisiblePapers();
      if (papers.length === 0) {
        promptTa.value = 'No papers in current view. Select "All" or a keyword above that matches your papers, then click this button again.';
        promptTa.classList.add('border', 'border-warning');
        return;
      }
      promptTa.value = buildRelatedWorkPrompt(papers);
      promptTa.classList.remove('border', 'border-warning');
    });

    if (btnCopyPrompt && promptTa) {
      btnCopyPrompt.addEventListener('click', function () {
        var text = promptTa.value.trim();
        if (!text) {
          alert('Prompt is empty. Click "Use current filter → fill prompt" first.');
          return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            alert('Copied. Paste into ChatGPT or Claude.');
          }).catch(function () { fallbackCopy(text); });
        } else {
          fallbackCopy(text);
        }
      });
    }

    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        alert('Copied. Paste into ChatGPT or Claude.');
      } catch (e) {
        prompt('Copy this prompt:', text);
      }
      document.body.removeChild(ta);
    }

    var selectProvider = document.getElementById('select-llm-provider');
    if (btnOpenAI && inputKey && promptTa && outputWrap && outputTa) {
      btnOpenAI.addEventListener('click', function () {
        var key = (inputKey.value || '').trim();
        var promptText = (promptTa.value || '').trim();
        if (!key) {
          alert('Please enter your API key.\n\nOpenAI: platform.openai.com/api-keys\nDeepSeek: platform.deepseek.com');
          return;
        }
        if (!promptText) {
          alert('Fill the prompt first (use "Use current filter → fill prompt").');
          return;
        }
        var provider = (selectProvider && selectProvider.value) ? selectProvider.value : 'openai';
        var apiUrl = provider === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        var model = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini';
        outputTa.value = 'Generating...';
        outputWrap.style.display = 'block';
        var req = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'user', content: promptText }
            ],
            temperature: 0.5
          })
        };
        fetch(apiUrl, req)
          .then(function (res) {
            if (!res.ok) return res.json().then(function (j) { throw new Error(j.error && j.error.message ? j.error.message : res.statusText); });
            return res.json();
          })
          .then(function (data) {
            var content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
            outputTa.value = content || '(No content returned.)';
          })
          .catch(function (err) {
            var msg = err.message || String(err);
            if (msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1 || (err.name && err.name === 'TypeError')) {
              msg = 'Failed to fetch (often CORS). The API may block requests from this site.\n\nTry: 1) Use "Copy prompt for ChatGPT" above and paste into chat.openai.com or platform.deepseek.com. 2) Run the site locally (e.g. bundle exec jekyll serve) and call Generate from http://localhost:4000.';
            }
            outputTa.value = 'Error: ' + msg;
          });
      });
    }

    if (btnCopyOutput && outputTa) {
      btnCopyOutput.addEventListener('click', function () {
        var text = outputTa.value;
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { alert('Copied.'); }).catch(function () { fallbackCopy(text); });
        } else {
          fallbackCopy(text);
        }
      });
    }
  }

  function init() {
    // Keyword filter: event delegation so all pills (YAML + dynamic) trigger filter for all papers (YAML + local)
    var pillsContainer = document.getElementById('keyword-pills');
    if (pillsContainer) {
      pillsContainer.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest && e.target.closest('.keyword-filter');
        if (!btn) return;
        var isAll = !(btn.getAttribute('data-keyword') || '').trim();
        if (isAll) {
          pillsContainer.querySelectorAll('.keyword-filter').forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
        } else {
          btn.classList.toggle('active');
          pillsContainer.querySelectorAll('.keyword-filter').forEach(function (b) {
            if (!(b.getAttribute('data-keyword') || '').trim()) b.classList.remove('active');
          });
        }
        applyFilter();
      });
    }
    var filterByAbstract = document.getElementById('filter-by-abstract');
    if (filterByAbstract) {
      filterByAbstract.addEventListener('input', applyFilter);
      filterByAbstract.addEventListener('keyup', applyFilter);
    }

    // Add form
    var form = document.getElementById('form-add-paper');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var title = document.getElementById('input-title').value.trim();
        var url = document.getElementById('input-url').value.trim();
        var kwStr = (document.getElementById('input-keywords').value || '').trim();
        var notes = (document.getElementById('input-notes').value || '').trim();
        var abstract = (document.getElementById('input-abstract') && document.getElementById('input-abstract').value) ? document.getElementById('input-abstract').value.trim() : '';
        var keywords = kwStr ? kwStr.split(/[,，]/).map(function (k) { return k.trim(); }).filter(Boolean) : [];

        var papers = getLocalPapers();
        papers.unshift({
          title: title,
          url: url,
          date: todayStr(),
          keywords: keywords,
          notes: notes,
          abstract: abstract
        });
        setLocalPapers(papers);

        document.getElementById('input-title').value = '';
        document.getElementById('input-url').value = '';
        document.getElementById('input-keywords').value = '';
        document.getElementById('input-notes').value = '';
        if (document.getElementById('input-abstract')) document.getElementById('input-abstract').value = '';

        renderLocalPapers();
        updateKeywordPills();
        applyFilter();
      });
    }

    // Pre-fill from URL (e.g. bookmarklet: ?add=1&url=...&title=...)
    var params = new URLSearchParams(window.location.search);
    if (params.get('add') === '1') {
      var preUrl = params.get('url');
      var preTitle = params.get('title') || '';
      if (preUrl) {
        document.getElementById('input-url').value = preUrl;
        if (preTitle) document.getElementById('input-title').value = preTitle;
        var collapse = document.getElementById('add-paper-form');
        if (collapse && typeof window.bootstrap !== 'undefined') {
          new window.bootstrap.Collapse(collapse, { toggle: true });
        } else if (collapse) {
          collapse.classList.add('show');
        }
      }
    }

    function isPdfFilename(title) {
      return /^\d+\.\d+v?\d*\.pdf$/i.test((title || '').trim());
    }

    // Export YAML — show in a dynamically created overlay (works even if page HTML is old/cached)
    var btnExport = document.getElementById('btn-export-yaml');
    function doExportYaml() {
      var papers = getLocalPapers();
      if (papers.length === 0) {
        alert('No locally saved papers to export.');
        return;
      }
      var byCanon = {};
      papers.forEach(function (p) {
        var canon = canonicalUrl(p.url);
        if (!canon || canon.indexOf('chrome-extension:') === 0) return;
        var url = p.url || '';
        var isRealUrl = url.indexOf('http://') === 0 || url.indexOf('https://') === 0;
        var title = (p.title || '').trim();
        var goodTitle = title && !isPdfFilename(title) && title !== '(No title)';
        var cur = byCanon[canon];
        if (!cur) {
          byCanon[canon] = { title: title || '(No title)', url: canon, date: p.date || '', keywords: p.keywords || [], notes: p.notes || '', abstract: p.abstract || '', citation: p.citation || null, citationText: p.citationText || '' };
          return;
        }
        var curGood = cur.title && !isPdfFilename(cur.title) && cur.title !== '(No title)';
        if (goodTitle && !curGood) {
          cur.title = title;
          cur.keywords = p.keywords || [];
          cur.notes = p.notes || '';
          cur.abstract = p.abstract || cur.abstract;
          cur.citation = p.citation || cur.citation;
          cur.citationText = p.citationText || cur.citationText;
          cur.date = p.date || cur.date;
        } else if (goodTitle && curGood && title.length > (cur.title || '').length) {
          cur.title = title;
          cur.keywords = p.keywords || cur.keywords;
          cur.notes = p.notes || cur.notes;
          cur.abstract = p.abstract || cur.abstract;
          cur.citation = p.citation || cur.citation;
          cur.citationText = p.citationText || cur.citationText;
          cur.date = p.date || cur.date;
        }
      });
      var list = Object.keys(byCanon).map(function (k) {
        var p = byCanon[k];
        if (isPdfFilename(p.title)) {
          var idMatch = p.url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
          p = { title: idMatch ? 'arXiv ' + idMatch[1] : p.title, url: p.url, date: p.date, keywords: p.keywords, notes: p.notes, abstract: p.abstract || '', citation: p.citation || null, citationText: p.citationText || '' };
        }
        return p;
      });
      var yaml = list.map(function (p) {
        var lines = [
          '  - title: "' + (p.title || '').replace(/"/g, '\\"') + '"',
          '    url: ' + (p.url || ''),
          '    date: "' + (p.date || '') + '"',
          '    keywords:'
        ];
        (p.keywords || []).forEach(function (k) {
          lines.push('      - ' + (k.indexOf(' ') >= 0 || k.indexOf(':') >= 0 ? '"' + k.replace(/"/g, '\\"') + '"' : k));
        });
        lines.push('    notes: "' + (p.notes || '').replace(/"/g, '\\"') + '"');
        var abs = (p.abstract || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
        if (abs) lines.push('    abstract: "' + abs + '"');
        var ctext = (p.citationText || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
        if (ctext) lines.push('    citation_text: "' + ctext + '"');
        return lines.join('\n');
      }).join('\n\n');
      var full = '# Paste under papers: in _data/reading_papers.yml\n\n' + yaml;
      var ta = document.createElement('textarea');
      ta.value = full;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch (err) {}
      document.body.removeChild(ta);

      var overlay = document.createElement('div');
      overlay.id = 'reading-list-export-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;';
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:90%;max-height:85vh;width:680px;display:flex;flex-direction:column;overflow:hidden;border:2px solid #333;';
      box.innerHTML =
        '<div style="padding:16px 20px;border-bottom:2px solid #333;display:flex;justify-content:space-between;align-items:center;background:#f8f9fa;">' +
        '<strong style="font-size:1.1rem;">Exported YAML — copy from the box below</strong>' +
        '<button type="button" id="reading-list-export-close" style="background:#333;color:#fff;border:none;font-size:20px;line-height:1;cursor:pointer;width:36px;height:36px;border-radius:4px;">&times;</button>' +
        '</div>' +
        '<div style="padding:16px 20px;overflow:auto;flex:1;">' +
        '<p style="margin-bottom:8px;font-weight:bold;">Paste the content below under <code>papers:</code> in <code>_data/reading_papers.yml</code></p>' +
        '<textarea id="reading-list-export-text" readonly style="width:100%;height:320px;font-family:monospace;font-size:13px;padding:12px;border:2px solid #333;border-radius:4px;resize:vertical;background:#fff;"></textarea>' +
        '<button type="button" id="reading-list-export-copy" class="btn btn-primary mt-2"><i class="fas fa-copy mr-1"></i> Copy</button>' +
        '</div>';
      var textarea = box.querySelector('#reading-list-export-text');
      textarea.value = full;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      textarea.focus();

      var inlineBox = document.getElementById('export-yaml-inline');
      var inlineText = document.getElementById('export-yaml-inline-text');
      var btnCopyInline = document.getElementById('btn-copy-inline-yaml');
      if (inlineBox && inlineText) {
        inlineText.value = full;
        inlineBox.style.display = 'block';
        inlineBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      if (btnCopyInline && inlineText) {
        btnCopyInline.onclick = function () {
          inlineText.select();
          try { document.execCommand('copy'); alert('Copied.'); } catch (e) {}
        };
      }

      function closeOverlay() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeOverlay();
      });
      box.querySelector('#reading-list-export-close').addEventListener('click', closeOverlay);
      box.querySelector('#reading-list-export-copy').addEventListener('click', function () {
        textarea.select();
        try {
          document.execCommand('copy');
          alert('Copied.');
        } catch (e) {}
      });
    }
    if (btnExport) btnExport.addEventListener('click', doExportYaml);

    renderLocalPapers();
    updateKeywordPills();
    applyFilter();
    initRelatedWork();

    function normalizeUrl(u) {
      if (!u) return '';
      return u.replace(/#.*$/, '').replace(/\/+$/, '') || u;
    }

    function mergeFromExtension(autoPapers) {
      if (!autoPapers || !autoPapers.length) return;
      var local = getLocalPapers();
      var byUrl = {};
      local.forEach(function (p) { byUrl[normalizeUrl(p.url)] = p; });
      var mergedCount = 0;
      var updatedCount = 0;
      function citationAuthorCount(c) {
        return c && c.authors && Array.isArray(c.authors) ? c.authors.filter(Boolean).length : 0;
      }
      function hasWeakCitationText(t) {
        if (!t || t.length < 10) return true;
        var s = (t || '').trim();
        // Typical weak fallback: "Title. https://..."
        if (/https?:\/\/\S+$/i.test(s) && s.indexOf('doi:') === -1 && s.indexOf('(') === -1) return true;
        return false;
      }
      function isWeakTitle(t) {
        if (!t || t.length < 2) return true;
        if (t === '(No title)') return true;
        if (/^(arXiv|IEEE|ACM)\s+[\d.]+\s*$/.test(t.trim())) return true;
        return false;
      }
      autoPapers.forEach(function (p) {
        var n = normalizeUrl(p.url);
        if (!p.url) return;
        var incomingTitle = (p.title || '').trim() || '(No title)';
        var existing = byUrl[n];
        if (!existing) {
          byUrl[n] = { title: incomingTitle, url: p.url.replace(/#.*$/, '').replace(/\/+$/, ''), date: p.date || '', keywords: p.keywords || [], notes: p.notes || '', abstract: p.abstract || '', citation: p.citation || null, citationText: p.citationText || '' };
          local.unshift(byUrl[n]);
          mergedCount++;
        } else if (isWeakTitle(existing.title) && !isWeakTitle(incomingTitle)) {
          existing.title = incomingTitle;
          updatedCount++;
        }
        var target = existing || byUrl[n];
        var incomingAuthors = citationAuthorCount(p.citation);
        var existingAuthors = citationAuthorCount(target.citation);
        var shouldUpgradeCitation =
          (!!p.citationText && !target.citationText) ||
          (incomingAuthors > existingAuthors) ||
          (incomingAuthors > 0 && hasWeakCitationText(target.citationText || ''));
        if (shouldUpgradeCitation && p.citationText) {
          target.citationText = p.citationText;
          target.citation = p.citation || target.citation || null;
          updatedCount++;
        }
      });
      if (mergedCount > 0 || updatedCount > 0) {
        setLocalPapers(local);
        renderLocalPapers();
        updateKeywordPills();
        applyFilter();
        var msg = document.getElementById('auto-record-msg');
        if (msg) {
          var parts = [];
          if (mergedCount > 0) parts.push(mergedCount + ' new merged');
          if (updatedCount > 0) parts.push(updatedCount + ' title(s) updated');
          msg.textContent = 'Extension: ' + parts.join(', ') + '.';
          msg.style.display = 'block';
        }
      }
    }

    var params = new URLSearchParams(window.location.search);
    var payload = params.get('extension_payload');
    if (payload) {
      try {
        var decoded = decodeURIComponent(escape(atob(payload)));
        var list = JSON.parse(decoded);
        if (Array.isArray(list)) mergeFromExtension(list);
      } catch (e) {}
      var clean = new URLSearchParams(window.location.search);
      clean.delete('extension_payload');
      var newSearch = clean.toString();
      var newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
      if (window.history && window.history.replaceState) window.history.replaceState(null, '', newUrl);
    }

    var btnSyncExt = document.getElementById('btn-sync-extension');
    if (btnSyncExt) {
      btnSyncExt.title = 'Click the Reading List extension icon in the toolbar, then "Open Reading List (merge saved papers)"';
    }

    var btnDedup = document.getElementById('btn-dedup-local');
    if (btnDedup) {
      btnDedup.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        runDedup();
      });
    }

    var bookmarkletEl = document.getElementById('bookmarklet-add-current');
    if (bookmarkletEl) {
      var base = window.location.origin + window.location.pathname.replace(/\?.*$/, '').replace(/#.*$/, '');
      var code = "javascript:(function(){var u=location.href;var m=u.match(/(https?:\\/\\/[^\\s\"']*(?:arxiv\\.org|ieeexplore\\.ieee\\.org|dl\\.acm\\.org|springer\\.com|sciencedirect\\.com)[^\\s\"']*)/);if(m)u=m[1];window.open('" + base + "?add=1&url='+encodeURIComponent(u)+'&title='+encodeURIComponent(document.title),'_blank');})();";
      bookmarkletEl.href = code;
    }
  }

  function bindDedupButton() {
    var btn = document.getElementById('btn-dedup-local');
    if (btn && !btn._dedupBound) {
      btn._dedupBound = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        runDedup();
      });
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('#btn-dedup-local') : null;
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      runDedup();
    }
  }, true);

  window.runReadingListDedup = runDedup;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init();
      bindDedupButton();
    });
  } else {
    init();
    bindDedupButton();
  }
})();
