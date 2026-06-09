(function(document) {
  var toggle = document.querySelector('.sidebar-toggle');
  var sidebar = document.querySelector('#sidebar');
  var checkbox = document.querySelector('#sidebar-checkbox');
  var masthead = document.querySelector('.masthead');
  var scrollTopButton = document.querySelector('#scroll-top');
  var scrollTopProgress = document.querySelector('#scroll-top-progress');
  var articleWordCount = document.querySelector('#word-count');
  var post = articleWordCount ? document.querySelector('.post') : null;
  var links = document.querySelectorAll('a[href]');
  var codeBlocks = document.querySelectorAll('pre');
  var searchInput = document.querySelector('#site-search');
  var searchResults = document.querySelector('#search-results');
  var searchMeta = document.querySelector('#search-meta');
  var searchIndexUrl = '/search.json';
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
    codeBlocks.forEach(function(pre) {
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

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'code-copy-button';
      button.setAttribute('aria-label', 'Copy code');
      button.textContent = 'Copy';

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

      wrapper.appendChild(button);
    });
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

      if (postBody) {
        applyLocMetric(postElement, countCodeLinesFromRoot(postElement));
        return;
      }

      if (!postLink) {
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
            return;
          }

          applyLocMetric(postElement, countCodeLinesFromRoot(article));
        })
        .catch(function() {
          applyLocMetric(postElement, 0);
        });
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
    links.forEach(function(link) {
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

  function getSearchTerms(query) {
    return normalizeSearchText(query).split(' ').filter(Boolean);
  }

  function createTermRegex(term, flags) {
    return new RegExp('(^|[^a-z0-9])(' + escapeRegex(term) + ')(?=$|[^a-z0-9])', flags || 'i');
  }

  function matchesAllTerms(text, terms) {
    var normalized = normalizeSearchText(text);

    if (!terms.length) {
      return false;
    }

    return terms.every(function(term) {
      return createTermRegex(term).test(normalized);
    });
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

  function scoreSearchEntry(entry, terms) {
    var score = 0;
    var title = normalizeSearchText(entry.title);
    var tags = normalizeSearchText(entry.tags);
    var description = normalizeSearchText(entry.description);
    var content = normalizeSearchText(entry.content);

    terms.forEach(function(term) {
      if (createTermRegex(term).test(title)) score += 12;
      if (createTermRegex(term).test(tags)) score += 8;
      if (createTermRegex(term).test(description)) score += 5;
      if (createTermRegex(term).test(content)) score += 2;
    });

    return score;
  }

  function renderSearchResults(entries, query, terms) {
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
      var snippet = buildSnippet(entry.content || entry.description, terms);
      var tags = entry.tags ? '<p class="search-result-tags">' + escapeHtml(entry.tags) + '</p>' : '';

      return [
        '<article class="search-result">',
        '<h3><a href="' + escapeHtml(entry.url) + '">' + highlightTerms(entry.title, terms) + '</a></h3>',
        '<p class="search-result-date">' + escapeHtml(entry.date) + '</p>',
        tags,
        '<p class="search-result-snippet">' + highlightTerms(snippet, terms) + '</p>',
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
      var terms = getSearchTerms(rawQuery);

      if (!searchReady) {
        pendingQuery = query;
        return;
      }

      if (!query) {
        renderSearchResults([], '', []);
        return;
      }

      var results = searchData
        .map(function(entry) {
          return {
            entry: entry,
            score: scoreSearchEntry(entry, terms)
          };
        })
        .filter(function(result) {
          return result.score > 0 && (
            matchesAllTerms(result.entry.title, terms) ||
            matchesAllTerms(result.entry.tags, terms) ||
            matchesAllTerms(result.entry.description, terms) ||
            matchesAllTerms(result.entry.content, terms)
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

      renderSearchResults(results, rawQuery.trim(), terms);
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

  document.addEventListener('click', function(e) {
    var target = e.target;

    if(!checkbox.checked ||
       sidebar.contains(target) ||
       (target === checkbox || target === toggle)) return;

    checkbox.checked = false;
  }, false);

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

  installSearch();
  installPostLocMetrics();
  installHeadingAnchors();
  installCopyButtons();
  markExternalLinks();
})(document);
