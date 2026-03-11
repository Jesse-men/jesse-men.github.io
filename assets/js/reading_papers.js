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

  function renderLocalPapers() {
    var list = document.getElementById('papers-from-storage-list');
    var container = document.getElementById('papers-from-storage');
    if (!list || !container) return;

    var papers = getLocalPapers();
    if (papers.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    list.innerHTML = papers.map(function (p, i) {
      var keywords = (p.keywords || []).map(function (k) {
        return '<span class="badge badge-light border mr-1">' + escapeHtml(k) + '</span>';
      }).join('');
      return (
        '<div class="reading-paper-item border-bottom border-gray p-3" data-keywords="' +
        escapeHtml((p.keywords || []).join(',')) +
        '" data-source="local">' +
        '<div class="d-flex justify-content-between align-items-start flex-wrap">' +
        '<div class="flex-grow-1">' +
        '<h5 class="mt-0 mb-1 font-weight-normal">' +
        '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener">' + escapeHtml(p.title) + '</a>' +
        '</h5>' +
        '<p class="mb-1 small text-muted">' +
        '<span class="mr-2"><i class="far fa-calendar-alt mr-1"></i>' + escapeHtml(p.date || '') + '</span>' +
        (p.notes ? '<span><i class="far fa-sticky-note mr-1"></i>' + escapeHtml(p.notes) + '</span>' : '') +
        '</p>' +
        '<div class="keyword-tags">' + keywords + '</div>' +
        '</div>' +
        '<div>' +
        '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary ml-2">Open</a> ' +
        '<button type="button" class="btn btn-sm btn-outline-danger ml-1 btn-remove-local" data-index="' + i + '">Remove</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    // Remove buttons
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
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function applyFilter() {
    var active = document.querySelector('.keyword-filter.active');
    var keyword = active ? (active.getAttribute('data-keyword') || '') : '';
    var showAll = !keyword || keyword === '*';
    document.querySelectorAll('.reading-paper-item').forEach(function (el) {
      var kw = (el.getAttribute('data-keywords') || '').split(',').map(function (k) { return k.trim(); });
      var show = showAll || kw.indexOf(keyword) !== -1;
      el.style.display = show ? '' : 'none';
    });
  }

  function updateKeywordPills() {
    var pillsContainer = document.getElementById('keyword-pills');
    if (!pillsContainer) return;

    var seen = {};
    pillsContainer.querySelectorAll('.keyword-filter[data-keyword=""]').forEach(function () {});
    document.querySelectorAll('.reading-paper-item').forEach(function (el) {
      var kw = (el.getAttribute('data-keywords') || '').split(',').map(function (k) { return k.trim(); }).filter(Boolean);
      kw.forEach(function (k) { seen[k] = true; });
    });

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
      btn.addEventListener('click', onKeywordClick);
      pillsContainer.appendChild(btn);
    });
  }

  function onKeywordClick() {
    document.querySelectorAll('.keyword-filter').forEach(function (b) { b.classList.remove('active'); });
    this.classList.add('active');
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
    var items = document.querySelectorAll('.reading-paper-item');
    var papers = [];
    items.forEach(function (el) {
      if (!isVisible(el)) return;
      var link = el.querySelector('h5 a') || el.querySelector('.flex-grow-1 a');
      var title = link ? link.textContent.trim() : '';
      var url = link ? (link.getAttribute('href') || '') : '';
      var notes = '';
      var icon = el.querySelector('.fa-sticky-note');
      if (icon && icon.parentNode) notes = icon.parentNode.textContent.replace(/\s+/g, ' ').trim();
      if (title) papers.push({ title: title, url: url, notes: notes });
    });
    return papers;
  }

  /** Build prompt text for LLM to generate Related Work. */
  function buildRelatedWorkPrompt(papers) {
    if (!papers.length) return '';
    var intro = 'Write a "Related Work" subsection for a research paper based on the following papers. ';
    intro += 'Use in-text citations [1], [2], etc. and list full references at the end. ';
    intro += 'Keep the narrative coherent and connect the works thematically.\n\nPapers:\n\n';
    var list = papers.map(function (p, i) {
      var line = '[' + (i + 1) + '] ' + p.title + ' — ' + p.url;
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

    if (btnOpenAI && inputKey && promptTa && outputWrap && outputTa) {
      btnOpenAI.addEventListener('click', function () {
        var key = (inputKey.value || '').trim();
        var promptText = (promptTa.value || '').trim();
        if (!key) {
          alert('Please enter your OpenAI API key in the field above.\n\nYou can create one at: platform.openai.com/api-keys');
          return;
        }
        if (!promptText) {
          alert('Fill the prompt first (use "Use current filter → fill prompt").');
          return;
        }
        outputTa.value = 'Generating...';
        outputWrap.style.display = 'block';
        var req = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'user', content: promptText }
            ],
            temperature: 0.5
          })
        };
        fetch('https://api.openai.com/v1/chat/completions', req)
          .then(function (res) {
            if (!res.ok) return res.json().then(function (j) { throw new Error(j.error && j.error.message ? j.error.message : res.statusText); });
            return res.json();
          })
          .then(function (data) {
            var content = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
            outputTa.value = content || '(No content returned.)';
          })
          .catch(function (err) {
            outputTa.value = 'Error: ' + (err.message || String(err));
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
    // Keyword filter
    document.querySelectorAll('.keyword-filter').forEach(function (btn) {
      btn.addEventListener('click', onKeywordClick);
    });

    // Add form
    var form = document.getElementById('form-add-paper');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var title = document.getElementById('input-title').value.trim();
        var url = document.getElementById('input-url').value.trim();
        var kwStr = (document.getElementById('input-keywords').value || '').trim();
        var notes = (document.getElementById('input-notes').value || '').trim();
        var keywords = kwStr ? kwStr.split(/[,，]/).map(function (k) { return k.trim(); }).filter(Boolean) : [];

        var papers = getLocalPapers();
        papers.unshift({
          title: title,
          url: url,
          date: todayStr(),
          keywords: keywords,
          notes: notes
        });
        setLocalPapers(papers);

        document.getElementById('input-title').value = '';
        document.getElementById('input-url').value = '';
        document.getElementById('input-keywords').value = '';
        document.getElementById('input-notes').value = '';

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

    // Export YAML
    var btnExport = document.getElementById('btn-export-yaml');
    if (btnExport) {
      btnExport.addEventListener('click', function () {
        var papers = getLocalPapers();
        if (papers.length === 0) {
          alert('No locally saved papers to export.');
          return;
        }
        var yaml = papers.map(function (p) {
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
          return lines.join('\n');
        }).join('\n\n');
        var full = '# Paste the following under papers: in _data/reading_papers.yml\n\n' + yaml;
        var ta = document.createElement('textarea');
        ta.value = full;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          alert('Copied to clipboard. Paste under papers: in _data/reading_papers.yml.');
        } catch (err) {
          prompt('Copy the following YAML:', full);
        }
        document.body.removeChild(ta);
      });
    }

    renderLocalPapers();
    updateKeywordPills();
    applyFilter();
    initRelatedWork();

    var ATTR_EXT = 'data-reading-list-extension';
    function mergeFromExtension(autoPapers) {
      if (!autoPapers || !autoPapers.length) return;
      var local = getLocalPapers();
      var urls = {};
      local.forEach(function (p) { urls[p.url] = true; });
      var mergedCount = 0;
      autoPapers.forEach(function (p) {
        if (p.url && !urls[p.url]) {
          urls[p.url] = true;
          local.unshift({ title: p.title || '(No title)', url: p.url, date: p.date || '', keywords: p.keywords || [], notes: p.notes || '' });
          mergedCount++;
        }
      });
      if (mergedCount > 0) {
        setLocalPapers(local);
        renderLocalPapers();
        updateKeywordPills();
        applyFilter();
        var msg = document.getElementById('auto-record-msg');
        if (msg) { msg.textContent = 'Extension: ' + mergedCount + ' paper(s) merged into list.'; msg.style.display = 'block'; }
      }
    }
    window.__readingListMergeFromExtension = mergeFromExtension;

    var pollCount = 0;
    var pollId = setInterval(function () {
      pollCount++;
      var root = document.documentElement || document.body;
      if (!root || !root.getAttribute) return;
      var raw = root.getAttribute(ATTR_EXT);
      if (raw) {
        root.removeAttribute(ATTR_EXT);
        try {
          var list = JSON.parse(raw);
          if (Array.isArray(list)) mergeFromExtension(list);
        } catch (e) {}
      }
      if (pollCount >= 20) clearInterval(pollId);
    }, 300);

    function readExtensionDataOnce() {
      var root = document.documentElement || document.body;
      if (!root || !root.getAttribute) return;
      var raw = root.getAttribute(ATTR_EXT);
      if (raw) {
        root.removeAttribute(ATTR_EXT);
        try {
          var list = JSON.parse(raw);
          if (Array.isArray(list)) mergeFromExtension(list);
        } catch (e) {}
      }
    }
    var btnSyncExt = document.getElementById('btn-sync-extension');
    if (btnSyncExt) {
      btnSyncExt.addEventListener('click', function () {
        window.dispatchEvent(new CustomEvent('reading-list-request-extension-papers'));
        setTimeout(readExtensionDataOnce, 200);
        setTimeout(readExtensionDataOnce, 600);
        setTimeout(readExtensionDataOnce, 1000);
      });
    }
    setTimeout(function () { window.dispatchEvent(new CustomEvent('reading-list-request-extension-papers')); }, 2000);
    setTimeout(function () { window.dispatchEvent(new CustomEvent('reading-list-request-extension-papers')); }, 4500);

    var bookmarkletEl = document.getElementById('bookmarklet-add-current');
    if (bookmarkletEl) {
      var base = window.location.origin + window.location.pathname.replace(/\?.*$/, '').replace(/#.*$/, '');
      var code = "javascript:(function(){var u=location.href;var m=u.match(/(https?:\\/\\/[^\\s\"']*(?:arxiv\\.org|ieeexplore\\.ieee\\.org|dl\\.acm\\.org|springer\\.com|sciencedirect\\.com)[^\\s\"']*)/);if(m)u=m[1];window.open('" + base + "?add=1&url='+encodeURIComponent(u)+'&title='+encodeURIComponent(document.title),'_blank');})();";
      bookmarkletEl.href = code;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
