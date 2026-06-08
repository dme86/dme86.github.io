(function(document) {
  var toggle = document.querySelector('.sidebar-toggle');
  var sidebar = document.querySelector('#sidebar');
  var checkbox = document.querySelector('#sidebar-checkbox');
  var scrollTopButton = document.querySelector('#scroll-top');
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
    toggleScrollTopButton();
  }

  markExternalLinks();
})(document);
