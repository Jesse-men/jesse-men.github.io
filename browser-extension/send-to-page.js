(function () {
  var STORAGE_KEY = 'reading_papers_auto';
  var ATTR = 'data-reading-list-extension';
  function send() {
    chrome.storage.local.get(STORAGE_KEY, function (data) {
      var list = data[STORAGE_KEY] || [];
      var root = document.documentElement || document.body;
      if (root) root.setAttribute(ATTR, JSON.stringify(list));
    });
  }
  send();
  setTimeout(send, 500);
  setTimeout(send, 1500);
  window.addEventListener('reading-list-request-extension-papers', function () { send(); });
})();
