(function(document) {
  var toggle = document.querySelector('.sidebar-toggle');
  var sidebar = document.querySelector('#sidebar');
  var checkbox = document.querySelector('#sidebar-checkbox');
  var masthead = document.querySelector('.masthead');
  var scrollTopButton = document.querySelector('#scroll-top');
  var scrollTopProgress = document.querySelector('#scroll-top-progress');
  var articleWordCount = document.querySelector('#word-count');
  var post = articleWordCount ? document.querySelector('.post') : null;
  var searchInput = document.querySelector('#site-search');
  var searchResults = document.querySelector('#search-results');
  var searchMeta = document.querySelector('#search-meta');
  var searchIndexUrl = '/search.json';
  var searchPageUrl = '/search/';
  var lastGKeyTime = 0;
  var keySequenceTimeout = 600;
  var navigationScrollStep = 48;
  var codeOverlay = null;
  var codeOverlayPreviousFocus = null;
  var codeOverlayWrapper = null;
  var expandedCodeHashPrefix = '#expand-';
  var keyboardShortcutsOverlay = null;
  var keyboardShortcutsPreviousFocus = null;
  var keyboardHint = null;
  var keyboardHintShowTimer = null;
  var keyboardHintTimer = null;
  var keyboardHintStorageKey = 'dme-keyboard-shortcuts-hint-seen';
  var codeLanguageAllowlist = [
    'yaml', 'yml', 'shell', 'sh', 'bash', 'zsh', 'python', 'py', 'json', 'jinja', 'jinja2',
    'terraform', 'hcl', 'go', 'javascript', 'js', 'typescript', 'ts', 'tsx', 'dockerfile',
    'html', 'css', 'sql', 'xml', 'toml', 'ini', 'conf'
  ];

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function(resolve, reject) {
      var textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'absolute';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();

      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        resolve();
      } catch (error) {
        document.body.removeChild(textArea);
        reject(error);
      }
    });
  }

  function installCopyButtons() {
    var codeBlockIndex = 0;

    document.querySelectorAll('pre').forEach(function(pre) {
      var wrapper = pre.parentElement;

      if (!wrapper || wrapper.classList.contains('code-block')) {
        return;
      }

      if (wrapper.classList.contains('highlight')) {
        wrapper.classList.add('code-block');
      } else {
        wrapper = document.createElement('div');
        wrapper.className = 'code-block';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
      }

      codeBlockIndex += 1;

      if (!wrapper.id) {
        wrapper.id = 'code-block-' + codeBlockIndex;
      }

      if (!wrapper.querySelector('.code-block-toolbar')) {
        var toolbar = document.createElement('div');
        toolbar.className = 'code-block-toolbar';
        wrapper.appendChild(toolbar);
      }

      var toolbar = wrapper.querySelector('.code-block-toolbar');

      if (!toolbar.querySelector('.code-link-button')) {
        var linkButton = document.createElement('a');
        linkButton.className = 'code-link-button';
        linkButton.href = '#' + wrapper.id;
        linkButton.setAttribute('aria-label', 'Link to this code block');
        linkButton.textContent = '#';
        toolbar.appendChild(linkButton);
      }

      if (!toolbar.querySelector('.code-expand-button')) {
        var expandButton = document.createElement('button');
        expandButton.type = 'button';
        expandButton.className = 'code-expand-button';
        expandButton.setAttribute('aria-label', 'Expand code block');
        expandButton.textContent = 'Expand';
        expandButton.addEventListener('click', function() {
          openCodeOverlay(wrapper);
        });
        toolbar.appendChild(expandButton);
      }

      var button = wrapper.querySelector('.code-copy-button');

      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'code-copy-button';
        button.setAttribute('aria-label', 'Copy code');
        button.textContent = 'Copy';
        toolbar.appendChild(button);
      }

      if (button.getAttribute('data-copy-ready') === 'true') {
        return;
      }

      button.setAttribute('data-copy-ready', 'true');
      button.addEventListener('click', function() {
        copyText(pre.innerText).then(function() {
          button.textContent = 'Copied';
          button.classList.add('is-copied');

          window.setTimeout(function() {
            button.textContent = 'Copy';
            button.classList.remove('is-copied');
          }, 1400);
        }).catch(function() {
          button.textContent = 'Error';

          window.setTimeout(function() {
            button.textContent = 'Copy';
          }, 1400);
        });
      });

    });
  }

  function ensureCodeOverlay() {
    if (codeOverlay) {
      return codeOverlay;
    }

    codeOverlay = document.createElement('div');
    codeOverlay.className = 'code-overlay';
    codeOverlay.hidden = true;
    codeOverlay.innerHTML = [
      '<div class="code-overlay-backdrop" data-code-close="true"></div>',
      '<div class="code-overlay-panel" role="dialog" aria-modal="true" aria-label="Expanded code block">',
      '<div class="code-overlay-toolbar">',
      '<span class="code-overlay-meta"></span>',
      '<div class="code-overlay-actions">',
      '<a class="code-overlay-link" href="#" aria-label="Link to expanded code block">#</a>',
      '<button type="button" class="code-overlay-copy">Copy</button>',
      '<button type="button" class="code-overlay-close" aria-label="Close expanded code block">Close</button>',
      '</div>',
      '</div>',
      '<div class="code-overlay-content"></div>',
      '</div>'
    ].join('');

    document.body.appendChild(codeOverlay);

    codeOverlay.addEventListener('click', function(event) {
      if (event.target.getAttribute('data-code-close') === 'true' || event.target.classList.contains('code-overlay-close')) {
        closeCodeOverlay();
      }
    });

    return codeOverlay;
  }

  function expandedCodeHash(wrapper) {
    return expandedCodeHashPrefix + encodeURIComponent(wrapper.id);
  }

  function expandedCodeWrapperFromHash() {
    if (window.location.hash.indexOf(expandedCodeHashPrefix) !== 0) {
      return null;
    }

    var wrapperId;

    try {
      wrapperId = decodeURIComponent(window.location.hash.slice(expandedCodeHashPrefix.length));
    } catch (error) {
      return null;
    }

    var wrapper = document.getElementById(wrapperId);

    if (!wrapper || !wrapper.classList.contains('code-block')) {
      return null;
    }

    return wrapper;
  }

  function openCodeOverlayFromHash() {
    var wrapper = expandedCodeWrapperFromHash();

    if (!wrapper) {
      if (codeOverlay && !codeOverlay.hidden && codeOverlayWrapper) {
        closeCodeOverlay(true);
      }

      return;
    }

    wrapper.scrollIntoView({ block: 'center' });

    if (!codeOverlay || codeOverlay.hidden || codeOverlayWrapper !== wrapper) {
      openCodeOverlay(wrapper);
    }
  }

  function openCodeOverlay(wrapper) {
    var overlay = ensureCodeOverlay();
    var content = overlay.querySelector('.code-overlay-content');
    var meta = overlay.querySelector('.code-overlay-meta');
    var link = overlay.querySelector('.code-overlay-link');
    var copyButton = overlay.querySelector('.code-overlay-copy');
    var closeButton = overlay.querySelector('.code-overlay-close');
    var codeElement = wrapper.querySelector('pre');

    if (!content || !meta || !link || !copyButton || !closeButton || !codeElement) {
      return;
    }

    var codeText = codeElement.innerText.replace(/\n$/, '');
    var codeLines = codeText ? codeText.split('\n') : [];
    var lineCount = codeLines.length;
    var longestLine = codeLines.reduce(function(longest, line) {
      return Math.max(longest, line.length);
    }, 0);
    var languageContainer = wrapper.matches('[class*="language-"]') ?
      wrapper :
      wrapper.querySelector('[class*="language-"]');
    var languageClass = languageContainer ?
      Array.from(languageContainer.classList).find(function(className) {
        return className.indexOf('language-') === 0;
      }) :
      null;
    var language = languageClass ? languageClass.replace('language-', '') : 'code';
    var overlaySize = 'compact';

    if (lineCount > 36 || longestLine > 100) {
      overlaySize = 'large';
    } else if (lineCount > 14 || longestLine > 68) {
      overlaySize = 'medium';
    }

    content.innerHTML = '';
    content.appendChild(codeElement.cloneNode(true));
    overlay.setAttribute('data-code-size', overlaySize);
    meta.textContent = language + ' · ' + lineCount + (lineCount === 1 ? ' line' : ' lines');
    link.href = expandedCodeHash(wrapper);

    copyButton.textContent = 'Copy';
    copyButton.onclick = function() {
      copyText(wrapper.querySelector('pre').innerText).then(function() {
        copyButton.textContent = 'Copied';
        window.setTimeout(function() {
          copyButton.textContent = 'Copy';
        }, 1400);
      }).catch(function() {
        copyButton.textContent = 'Error';
        window.setTimeout(function() {
          copyButton.textContent = 'Copy';
        }, 1400);
      });
    };

    dismissKeyboardHint();
    codeOverlayPreviousFocus = document.activeElement;
    codeOverlayWrapper = wrapper;
    overlay.hidden = false;
    document.body.classList.add('has-code-overlay');
    closeButton.focus();
  }

  function closeCodeOverlay(preserveHash) {
    if (!codeOverlay || codeOverlay.hidden) {
      return;
    }

    var wrapper = codeOverlayWrapper;
    var normalizeHash = !preserveHash &&
      wrapper &&
      window.location.hash === expandedCodeHash(wrapper);

    codeOverlay.hidden = true;
    document.body.classList.remove('has-code-overlay');

    if (codeOverlayPreviousFocus &&
        document.contains(codeOverlayPreviousFocus) &&
        typeof codeOverlayPreviousFocus.focus === 'function') {
      codeOverlayPreviousFocus.focus();
    }

    codeOverlayPreviousFocus = null;
    codeOverlayWrapper = null;

    if (normalizeHash) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search + '#' + wrapper.id
      );
      wrapper.scrollIntoView({ block: 'center' });
    }
  }

  function ensureKeyboardShortcutsOverlay() {
    if (keyboardShortcutsOverlay) {
      return keyboardShortcutsOverlay;
    }

    keyboardShortcutsOverlay = document.createElement('div');
    keyboardShortcutsOverlay.className = 'keyboard-shortcuts-overlay';
    keyboardShortcutsOverlay.hidden = true;
    keyboardShortcutsOverlay.innerHTML = [
      '<div class="keyboard-shortcuts-backdrop" data-shortcuts-close="true"></div>',
      '<div class="keyboard-shortcuts-panel" role="dialog" aria-modal="true" aria-labelledby="keyboard-shortcuts-title">',
      '<div class="keyboard-shortcuts-header">',
      '<h2 id="keyboard-shortcuts-title">Keyboard shortcuts</h2>',
      '<button type="button" class="keyboard-shortcuts-close" aria-label="Close keyboard shortcuts">Close</button>',
      '</div>',
      '<dl class="keyboard-shortcuts-list">',
      '<div><dt><kbd>j</kbd></dt><dd>Scroll down</dd></div>',
      '<div><dt><kbd>k</kbd></dt><dd>Scroll up</dd></div>',
      '<div><dt><kbd>gg</kbd></dt><dd>Jump to the top</dd></div>',
      '<div><dt><kbd>G</kbd></dt><dd>Jump to the bottom</dd></div>',
      '<div><dt><kbd>h</kbd></dt><dd>Go to the homepage</dd></div>',
      '<div><dt><kbd>/</kbd></dt><dd>Open search</dd></div>',
      '<div><dt><kbd>?</kbd></dt><dd>Show these shortcuts</dd></div>',
      '<div><dt><kbd>Esc</kbd></dt><dd>Close this panel</dd></div>',
      '</dl>',
      '</div>'
    ].join('');

    document.body.appendChild(keyboardShortcutsOverlay);

    keyboardShortcutsOverlay.addEventListener('click', function(event) {
      if (event.target.getAttribute('data-shortcuts-close') === 'true' ||
          event.target.classList.contains('keyboard-shortcuts-close')) {
        closeKeyboardShortcutsOverlay();
      }
    });

    return keyboardShortcutsOverlay;
  }

  function openKeyboardShortcutsOverlay() {
    var overlay = ensureKeyboardShortcutsOverlay();
    var closeButton = overlay.querySelector('.keyboard-shortcuts-close');

    keyboardShortcutsPreviousFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('has-keyboard-shortcuts-overlay');

    if (closeButton) {
      closeButton.focus();
    }
  }

  function closeKeyboardShortcutsOverlay() {
    if (!keyboardShortcutsOverlay || keyboardShortcutsOverlay.hidden) {
      return;
    }

    keyboardShortcutsOverlay.hidden = true;
    document.body.classList.remove('has-keyboard-shortcuts-overlay');

    if (keyboardShortcutsPreviousFocus &&
        document.contains(keyboardShortcutsPreviousFocus) &&
        typeof keyboardShortcutsPreviousFocus.focus === 'function') {
      keyboardShortcutsPreviousFocus.focus();
    }

    keyboardShortcutsPreviousFocus = null;
  }

  function hasSeenKeyboardHint() {
    try {
      return window.localStorage.getItem(keyboardHintStorageKey) === 'true';
    } catch (error) {
      return false;
    }
  }

  function markKeyboardHintAsSeen() {
    try {
      window.localStorage.setItem(keyboardHintStorageKey, 'true');
    } catch (error) {
      // Storage may be unavailable in strict privacy modes.
    }
  }

  function dismissKeyboardHint() {
    if (keyboardHintShowTimer) {
      window.clearTimeout(keyboardHintShowTimer);
      keyboardHintShowTimer = null;
    }

    if (!keyboardHint || keyboardHint.hidden) {
      return;
    }

    if (keyboardHintTimer) {
      window.clearTimeout(keyboardHintTimer);
      keyboardHintTimer = null;
    }

    keyboardHint.classList.remove('is-visible');

    window.setTimeout(function() {
      if (keyboardHint && !keyboardHint.classList.contains('is-visible')) {
        keyboardHint.hidden = true;
      }
    }, 220);
  }

  function installKeyboardHint() {
    if (hasSeenKeyboardHint() || (codeOverlay && !codeOverlay.hidden)) {
      return;
    }

    keyboardHint = document.createElement('aside');
    keyboardHint.className = 'keyboard-hint';
    keyboardHint.hidden = true;
    keyboardHint.setAttribute('role', 'status');
    keyboardHint.setAttribute('aria-live', 'polite');
    keyboardHint.innerHTML = [
      '<p>Keyboard user? Press <kbd>?</kbd> to see the shortcuts.</p>',
      '<button type="button" class="keyboard-hint-close" aria-label="Dismiss keyboard shortcut hint">&times;</button>'
    ].join('');

    document.body.appendChild(keyboardHint);

    keyboardHint.querySelector('.keyboard-hint-close').addEventListener('click', function() {
      dismissKeyboardHint();
    });

    keyboardHintShowTimer = window.setTimeout(function() {
      keyboardHintShowTimer = null;
      keyboardHint.hidden = false;
      markKeyboardHintAsSeen();

      window.requestAnimationFrame(function() {
        keyboardHint.classList.add('is-visible');
      });

      keyboardHintTimer = window.setTimeout(function() {
        dismissKeyboardHint();
      }, 5000);
    }, 1000);
  }

  function countCodeLinesFromRoot(root) {
    var locCount = 0;

    root.querySelectorAll('div[class*="language-"] pre code').forEach(function(codeElement) {
      var languageContainer = codeElement.closest('[class*="language-"]');

      if (!languageContainer) {
        return;
      }

      var languageClass = Array.from(languageContainer.classList).find(function(className) {
        return className.indexOf('language-') === 0;
      });

      if (!languageClass) {
        return;
      }

      var language = languageClass.replace('language-', '').toLowerCase();

      if (codeLanguageAllowlist.indexOf(language) === -1) {
        return;
      }

      codeElement.textContent.split('\n').forEach(function(line) {
        if (line.trim()) {
          locCount += 1;
        }
      });
    });

    return locCount;
  }

  function applyLocMetric(postElement, locCount) {
    var metric = postElement.querySelector('.js-code-metric');
    var value = postElement.querySelector('.js-loc-count');

    if (!metric || !value) {
      return;
    }

    if (locCount > 0) {
      value.textContent = locCount;
      metric.hidden = false;
    } else {
      metric.hidden = true;
    }
  }

  function installPostLocMetrics() {
    document.querySelectorAll('.post').forEach(function(postElement) {
      var postLink = postElement.querySelector('.post-title a');
      var postBody = postElement.querySelector('.post-header') ? postElement : null;

      if (postElement.getAttribute('data-loc-state')) {
        return;
      }

      postElement.setAttribute('data-loc-state', 'loading');

      if (postBody) {
        applyLocMetric(postElement, countCodeLinesFromRoot(postElement));
        postElement.setAttribute('data-loc-state', 'ready');
        return;
      }

      if (!postLink) {
        postElement.setAttribute('data-loc-state', 'ready');
        return;
      }

      fetch(postLink.href, { headers: { Accept: 'text/html' } })
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Failed to load article');
          }

          return response.text();
        })
        .then(function(html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var article = doc.querySelector('.post');

          if (!article) {
            postElement.setAttribute('data-loc-state', 'ready');
            return;
          }

          applyLocMetric(postElement, countCodeLinesFromRoot(article));
          postElement.setAttribute('data-loc-state', 'ready');
        })
        .catch(function() {
          applyLocMetric(postElement, 0);
          postElement.setAttribute('data-loc-state', 'ready');
        });
    });
  }

  function formatPostAge(publishedAt) {
    var ageMilliseconds = Date.now() - publishedAt.getTime();

    if (!Number.isFinite(ageMilliseconds) || ageMilliseconds < 0) {
      ageMilliseconds = 0;
    }

    var ageMinutes = Math.floor(ageMilliseconds / 60000);
    var ageHours = Math.floor(ageMilliseconds / 3600000);
    var ageDays = Math.floor(ageMilliseconds / 86400000);
    var ageWeeks = Math.floor(ageDays / 7);
    var ageMonths = Math.floor(ageDays / 30);
    var ageYears = Math.floor(ageDays / 365);

    if (ageMinutes < 10) {
      return 'few minutes old';
    }

    if (ageHours < 1) {
      return ageMinutes + ' minutes old';
    }

    if (ageHours < 24) {
      return ageHours === 1 ? '1 hour old' : ageHours + ' hours old';
    }

    if (ageDays < 7) {
      return ageDays === 1 ? '1 day old' : ageDays + ' days old';
    }

    if (ageDays < 30) {
      return ageWeeks === 1 ? 'over a week old' : ageWeeks + ' weeks old';
    }

    if (ageDays < 365) {
      return ageMonths === 1 ? 'over a month old' : ageMonths + ' months old';
    }

    if (ageDays < 730) {
      return 'over a year old';
    }

    return ageYears + ' years old';
  }

  function updatePostAges() {
    document.querySelectorAll('.js-post-age').forEach(function(element) {
      var dateValue = element.getAttribute('data-post-date');
      var publishedAt = dateValue ? new Date(dateValue) : null;

      if (!publishedAt || Number.isNaN(publishedAt.getTime())) {
        return;
      }

      element.textContent = '(' + formatPostAge(publishedAt) + ')';
    });
  }

  function installHeadingAnchors() {
    var headings = document.querySelectorAll('.post h2[id], .post h3[id], .post h4[id], .post h5[id], .post h6[id]');

    headings.forEach(function(heading) {
      if (heading.querySelector('.heading-anchor')) {
        return;
      }

      var anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = '#' + heading.id;
      anchor.setAttribute('aria-label', 'Link to this section');
      anchor.textContent = '#';

      heading.appendChild(document.createTextNode(' '));
      heading.appendChild(anchor);
    });
  }

  function markExternalLinks() {
    document.querySelectorAll('a[href]').forEach(function(link) {
      var href = link.getAttribute('href');

      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) {
        return;
      }

      var url;

      try {
        url = new URL(link.href, window.location.origin);
      } catch (error) {
        return;
      }

      if (url.origin !== window.location.origin) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  function syncMastheadOffset() {
    if (!masthead) return;

    document.documentElement.style.setProperty('--masthead-offset', masthead.offsetHeight + 'px');
  }

  function normalizeSearchText(value) {
    return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseSearchQuery(query) {
    var parsed = {
      generalTerms: [],
      titleTerms: [],
      contentTerms: [],
      tagsTerms: [],
      descriptionTerms: []
    };

    normalizeSearchText(query).split(' ').filter(Boolean).forEach(function(token) {
      var separatorIndex = token.indexOf(':');
      var field = separatorIndex > 0 ? token.slice(0, separatorIndex) : '';
      var term = separatorIndex > 0 ? token.slice(separatorIndex + 1) : token;

      if (!term) {
        return;
      }

      if (field === 'title' || field === 'headline') {
        parsed.titleTerms.push(term);
        return;
      }

      if (field === 'content' || field === 'body') {
        parsed.contentTerms.push(term);
        return;
      }

      if (field === 'tags' || field === 'tag') {
        parsed.tagsTerms.push(term);
        return;
      }

      if (field === 'description' || field === 'desc') {
        parsed.descriptionTerms.push(term);
        return;
      }

      parsed.generalTerms.push(token);
    });

    parsed.allTerms = []
      .concat(parsed.generalTerms, parsed.titleTerms, parsed.contentTerms, parsed.tagsTerms, parsed.descriptionTerms);

    return parsed;
  }

  function createTermRegex(term, flags) {
    return new RegExp('(^|[^a-z0-9])(' + escapeRegex(term) + ')(?=$|[^a-z0-9])', flags || 'i');
  }

  function matchesAllTerms(text, terms) {
    var normalized = normalizeSearchText(text);

    if (!terms.length) {
      return true;
    }

    return terms.every(function(term) {
      return createTermRegex(term).test(normalized);
    });
  }

  function matchesAnyField(entry, term) {
    return (
      createTermRegex(term).test(normalizeSearchText(entry.title)) ||
      createTermRegex(term).test(normalizeSearchText(entry.tags)) ||
      createTermRegex(term).test(normalizeSearchText(entry.description)) ||
      createTermRegex(term).test(normalizeSearchText(entry.content))
    );
  }

  function highlightTerms(text, terms) {
    var highlighted = escapeHtml(text);

    terms.forEach(function(term) {
      var regex = new RegExp('(^|[^A-Za-z0-9])(' + escapeRegex(term) + ')(?=$|[^A-Za-z0-9])', 'gi');
      highlighted = highlighted.replace(regex, function(_, prefix, match) {
        return prefix + '<strong class="search-hit">' + match + '</strong>';
      });
    });

    return highlighted;
  }

  function buildSnippet(text, terms) {
    var source = (text || '').replace(/\s+/g, ' ').trim();

    if (!source) {
      return '';
    }

    if (!terms.length) {
      return source.slice(0, 180) + (source.length > 180 ? '...' : '');
    }

    var lowerSource = source.toLowerCase();
    var matchIndex = -1;
    var matchLength = 0;

    terms.some(function(term) {
      var regex = createTermRegex(term, 'i');
      var match = regex.exec(lowerSource);

      if (match) {
        matchIndex = match.index + match[1].length;
        matchLength = match[2].length;
        return true;
      }

      return false;
    });

    if (matchIndex === -1) {
      return source.slice(0, 180) + (source.length > 180 ? '...' : '');
    }

    var start = Math.max(0, matchIndex - 70);
    var end = Math.min(source.length, matchIndex + matchLength + 110);
    var snippet = source.slice(start, end);

    if (start > 0) {
      snippet = '...' + snippet;
    }

    if (end < source.length) {
      snippet += '...';
    }

    return snippet;
  }

  function scoreSearchEntry(entry, parsedQuery) {
    var score = 0;
    var title = normalizeSearchText(entry.title);
    var tags = normalizeSearchText(entry.tags);
    var description = normalizeSearchText(entry.description);
    var content = normalizeSearchText(entry.content);

    parsedQuery.generalTerms.forEach(function(term) {
      if (createTermRegex(term).test(title)) score += 12;
      if (createTermRegex(term).test(tags)) score += 8;
      if (createTermRegex(term).test(description)) score += 5;
      if (createTermRegex(term).test(content)) score += 2;
    });

    parsedQuery.titleTerms.forEach(function(term) {
      if (createTermRegex(term).test(title)) score += 20;
    });

    parsedQuery.contentTerms.forEach(function(term) {
      if (createTermRegex(term).test(content)) score += 10;
    });

    parsedQuery.tagsTerms.forEach(function(term) {
      if (createTermRegex(term).test(tags)) score += 12;
    });

    parsedQuery.descriptionTerms.forEach(function(term) {
      if (createTermRegex(term).test(description)) score += 8;
    });

    return score;
  }

  function renderSearchResults(entries, query, parsedQuery) {
    if (!searchResults || !searchMeta) return;

    if (!query) {
      searchMeta.textContent = '';
      searchResults.innerHTML = '';
      return;
    }

    if (!entries.length) {
      searchMeta.textContent = 'No posts matched "' + query + '".';
      searchResults.innerHTML = '';
      return;
    }

    searchMeta.textContent = entries.length + ' result' + (entries.length === 1 ? '' : 's') + ' for "' + query + '".';

    searchResults.innerHTML = entries.map(function(entry) {
      var snippetTerms = parsedQuery.contentTerms.length ? parsedQuery.contentTerms : parsedQuery.generalTerms;
      var snippetSource = entry.content || entry.description;
      var snippet = buildSnippet(snippetSource, snippetTerms);
      var tags = entry.tags ? '<p class="search-result-tags">' + escapeHtml(entry.tags) + '</p>' : '';
      var titleHighlightTerms = parsedQuery.titleTerms.length ? parsedQuery.titleTerms.concat(parsedQuery.generalTerms) : parsedQuery.allTerms;
      var snippetHighlightTerms = snippetTerms.length ? snippetTerms : parsedQuery.allTerms;

      return [
        '<article class="search-result">',
        '<h3><a href="' + escapeHtml(entry.url) + '">' + highlightTerms(entry.title, titleHighlightTerms) + '</a></h3>',
        '<p class="search-result-date">' + escapeHtml(entry.date) + '</p>',
        tags,
        '<p class="search-result-snippet">' + highlightTerms(snippet, snippetHighlightTerms) + '</p>',
        '</article>'
      ].join('');
    }).join('');
  }

  function installSearch() {
    if (!searchInput || !searchResults || !searchMeta) return;

    var searchData = [];
    var searchReady = false;
    var pendingQuery = '';

    function syncSearchUrl(rawQuery) {
      var url = new URL(window.location.href);
      var value = rawQuery.trim();

      if (value) {
        url.searchParams.set('q', value);
      } else {
        url.searchParams.delete('q');
      }

      window.history.replaceState({}, '', url.toString());
    }

    function runSearch(rawQuery) {
      var query = normalizeSearchText(rawQuery);
      var parsedQuery = parseSearchQuery(rawQuery);

      if (!searchReady) {
        pendingQuery = query;
        return;
      }

      if (!query) {
        renderSearchResults([], '', parsedQuery);
        return;
      }

      var results = searchData
        .map(function(entry) {
          return {
            entry: entry,
            score: scoreSearchEntry(entry, parsedQuery)
          };
        })
        .filter(function(result) {
          var entry = result.entry;

          return result.score > 0 && (
            parsedQuery.generalTerms.every(function(term) {
              return matchesAnyField(entry, term);
            }) &&
            matchesAllTerms(entry.title, parsedQuery.titleTerms) &&
            matchesAllTerms(entry.content, parsedQuery.contentTerms) &&
            matchesAllTerms(entry.tags, parsedQuery.tagsTerms) &&
            matchesAllTerms(entry.description, parsedQuery.descriptionTerms)
          );
        })
        .sort(function(a, b) {
          if (b.score !== a.score) {
            return b.score - a.score;
          }

          return new Date(b.entry.sort_date) - new Date(a.entry.sort_date);
        })
        .slice(0, 20)
        .map(function(result) {
          return result.entry;
        });

      renderSearchResults(results, rawQuery.trim(), parsedQuery);
    }

      searchMeta.textContent = 'Loading search index...';

    fetch(searchIndexUrl, { headers: { Accept: 'application/json' } })
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Failed to load search index');
        }

        return response.json();
      })
      .then(function(data) {
        searchData = data;
        searchReady = true;
        searchMeta.textContent = '';

        var params = new URLSearchParams(window.location.search);
        var initialQuery = params.get('q') || pendingQuery;

        if (initialQuery) {
          searchInput.value = initialQuery;
          runSearch(initialQuery);
        }
      })
      .catch(function() {
        searchMeta.textContent = 'Search index could not be loaded.';
      });

    searchInput.addEventListener('input', function() {
      syncSearchUrl(searchInput.value);
      runSearch(searchInput.value);
    });
  }

  function focusSearchInput() {
    if (!searchInput) return;

    window.setTimeout(function() {
      searchInput.focus();

      if (searchInput.value && typeof searchInput.setSelectionRange === 'function') {
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
    }, 0);
  }

  function isTextInput(target) {
    if (!target || target.nodeType !== 1) {
      return false;
    }

    return target.matches('input, textarea, select') || target.isContentEditable;
  }

  function handleNavigationShortcut(event) {
    var now = Date.now();
    var isStepKey = event.key === 'j' || event.key === 'k';

    if (event.defaultPrevented ||
        (event.repeat && !isStepKey) ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isTextInput(event.target) ||
        (codeOverlay && !codeOverlay.hidden) ||
        (keyboardShortcutsOverlay && !keyboardShortcutsOverlay.hidden)) {
      lastGKeyTime = 0;
      return;
    }

    if (event.key === '?') {
      event.preventDefault();
      lastGKeyTime = 0;
      markKeyboardHintAsSeen();
      dismissKeyboardHint();
      openKeyboardShortcutsOverlay();
      return;
    }

    if (event.key === '/') {
      event.preventDefault();
      lastGKeyTime = 0;

      if (searchInput) {
        focusSearchInput();
      } else {
        window.location.assign(searchPageUrl);
      }

      return;
    }

    if (event.key === 'h') {
      event.preventDefault();
      lastGKeyTime = 0;

      if (window.location.pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        window.location.assign('/');
      }

      return;
    }

    if (isStepKey) {
      event.preventDefault();
      lastGKeyTime = 0;
      window.scrollBy({
        top: event.key === 'j' ? navigationScrollStep : -navigationScrollStep,
        behavior: 'auto'
      });
      return;
    }

    if (event.key === 'G') {
      event.preventDefault();
      lastGKeyTime = 0;
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' });
      return;
    }

    if (event.key === 'g') {
      if (now - lastGKeyTime <= keySequenceTimeout) {
        event.preventDefault();
        lastGKeyTime = 0;
        window.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        lastGKeyTime = now;
      }

      return;
    }

    lastGKeyTime = 0;
  }

  function toggleScrollTopButton() {
    if (!scrollTopButton) return;

    if (window.scrollY > 280) {
      scrollTopButton.classList.add('is-visible');
    } else {
      scrollTopButton.classList.remove('is-visible');
    }
  }

  function updateReadingProgress() {
    if (!scrollTopButton || !scrollTopProgress || !post) return;

    var articleTop = post.offsetTop;
    var articleHeight = post.offsetHeight;
    var articleBottom = articleTop + articleHeight;
    var viewportOffset = window.innerHeight * 0.3;
    var distance = window.scrollY + viewportOffset - articleTop;
    var progress = Math.round((distance / articleHeight) * 100);
    var viewportBottom = window.scrollY + window.innerHeight;

    if (progress < 0) {
      progress = 0;
    }

    if (viewportBottom >= articleBottom) {
      progress = 100;
    } else if (progress > 100) {
      progress = 100;
    }

    scrollTopProgress.textContent = progress + '%';
    scrollTopButton.classList.add('has-progress');
  }

  function installInfiniteScroll() {
    var postsContainer = document.querySelector('#post-list');
    var pagination = document.querySelector('#post-pagination');
    var nextPageLink = pagination ? pagination.querySelector('a.older') : null;
    var status = document.querySelector('#infinite-scroll-status');
    var sentinel = document.querySelector('#infinite-scroll-sentinel');
    var observer = null;
    var loading = false;

    if (!postsContainer || !pagination || !nextPageLink || !status || !sentinel) {
      return;
    }

    pagination.classList.add('has-infinite-scroll');
    nextPageLink.textContent = 'Load older articles';

    function stopObserving() {
      if (observer) {
        observer.disconnect();
      }
    }

    function loadNextPage() {
      if (loading || !nextPageLink.href) {
        return;
      }

      loading = true;
      stopObserving();
      pagination.classList.add('is-loading');
      nextPageLink.setAttribute('aria-disabled', 'true');
      status.textContent = 'Loading older articles...';

      fetch(nextPageLink.href, { headers: { Accept: 'text/html' } })
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Failed to load older articles');
          }

          return response.text().then(function(html) {
            return {
              html: html,
              url: response.url
            };
          });
        })
        .then(function(result) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(result.html, 'text/html');
          var olderPosts = Array.from(doc.querySelectorAll('#post-list > .post'));
          var followingPageLink = doc.querySelector('#post-pagination a.older');

          if (!olderPosts.length) {
            throw new Error('Older article page contained no articles');
          }

          olderPosts.forEach(function(olderPost) {
            postsContainer.appendChild(document.importNode(olderPost, true));
          });

          installPostLocMetrics();
          updatePostAges();
          installHeadingAnchors();
          installCopyButtons();
          openCodeOverlayFromHash();
          markExternalLinks();

          if (followingPageLink) {
            nextPageLink.href = new URL(followingPageLink.getAttribute('href'), result.url).toString();
            nextPageLink.removeAttribute('aria-disabled');
            status.textContent = 'Loaded ' + olderPosts.length + ' older articles.';

            if (observer) {
              observer.observe(sentinel);
            }
          } else {
            nextPageLink.hidden = true;
            status.textContent = 'All articles loaded.';
            pagination.classList.add('is-complete');
          }
        })
        .catch(function() {
          nextPageLink.removeAttribute('aria-disabled');
          status.textContent = 'Older articles could not be loaded. Use the button to try again.';
          pagination.classList.add('has-error');
        })
        .finally(function() {
          loading = false;
          pagination.classList.remove('is-loading');
        });
    }

    nextPageLink.addEventListener('click', function(event) {
      event.preventDefault();
      pagination.classList.remove('has-error');
      loadNextPage();
    });

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function(entries) {
        if (entries.some(function(entry) { return entry.isIntersecting; })) {
          loadNextPage();
        }
      }, {
        rootMargin: '800px 0px'
      });

      observer.observe(sentinel);
    }
  }

  document.addEventListener('click', function(e) {
    var target = e.target;

    if(!checkbox.checked ||
       sidebar.contains(target) ||
       (target === checkbox || target === toggle)) return;

    checkbox.checked = false;
  }, false);

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closeCodeOverlay();
      closeKeyboardShortcutsOverlay();
      dismissKeyboardHint();
    }

    handleNavigationShortcut(event);
  });

  if (masthead) {
    syncMastheadOffset();
    window.addEventListener('resize', syncMastheadOffset);
    window.addEventListener('load', syncMastheadOffset);
  }

  if (scrollTopButton) {
    scrollTopButton.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', toggleScrollTopButton, { passive: true });
    window.addEventListener('scroll', updateReadingProgress, { passive: true });
    toggleScrollTopButton();
    updateReadingProgress();
  }

  window.addEventListener('hashchange', openCodeOverlayFromHash);

  installSearch();
  focusSearchInput();
  installInfiniteScroll();
  installPostLocMetrics();
  if (document.querySelector('.js-post-age')) {
    updatePostAges();
    window.setInterval(updatePostAges, 60000);
  }
  installHeadingAnchors();
  installCopyButtons();
  openCodeOverlayFromHash();
  markExternalLinks();
  installKeyboardHint();
})(document);
