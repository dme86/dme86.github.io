(function(document) {
  var toggle = document.querySelector('.sidebar-toggle');
  var sidebar = document.querySelector('#sidebar');
  var checkbox = document.querySelector('#sidebar-checkbox');
  var scrollTopButton = document.querySelector('#scroll-top');
  var scrollTopProgress = document.querySelector('#scroll-top-progress');
  var articleWordCount = document.querySelector('#word-count');
  var post = articleWordCount ? document.querySelector('.post') : null;
  var links = document.querySelectorAll('a[href]');
  var codeBlocks = document.querySelectorAll('pre');

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

  if (scrollTopButton) {
    scrollTopButton.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', toggleScrollTopButton, { passive: true });
    window.addEventListener('scroll', updateReadingProgress, { passive: true });
    toggleScrollTopButton();
    updateReadingProgress();
  }

  installCopyButtons();
  markExternalLinks();
})(document);
