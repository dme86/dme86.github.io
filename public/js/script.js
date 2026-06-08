(function(document) {
  var toggle = document.querySelector('.sidebar-toggle');
  var sidebar = document.querySelector('#sidebar');
  var checkbox = document.querySelector('#sidebar-checkbox');
  var scrollTopButton = document.querySelector('#scroll-top');
  var scrollTopProgress = document.querySelector('#scroll-top-progress');
  var post = document.querySelector('.post');
  var links = document.querySelectorAll('a[href]');

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
    var viewportOffset = window.innerHeight * 0.3;
    var distance = window.scrollY + viewportOffset - articleTop;
    var progress = Math.round((distance / articleHeight) * 100);

    if (progress < 0) {
      progress = 0;
    }

    if (progress > 100) {
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

  markExternalLinks();
})(document);
