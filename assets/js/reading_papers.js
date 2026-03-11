/**
 * 论文阅读记录页：关键词筛选、本机添加、导出 YAML
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
        '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary ml-2">打开</a> ' +
        '<button type="button" class="btn btn-sm btn-outline-danger ml-1 btn-remove-local" data-index="' + i + '">删除</button>' +
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
          alert('当前没有本机暂存的论文可导出。');
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
        var full = '# 将下面内容追加到 _data/reading_papers.yml 的 papers: 下\n\n' + yaml;
        var ta = document.createElement('textarea');
        ta.value = full;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          alert('已复制到剪贴板，请粘贴到 _data/reading_papers.yml 的 papers: 下列表中。');
        } catch (err) {
          prompt('请手动复制以下 YAML：', full);
        }
        document.body.removeChild(ta);
      });
    }

    renderLocalPapers();
    updateKeywordPills();
    applyFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
