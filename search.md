---
layout: page
title: Search
permalink: /search/
---

<div class="search-page">
  <div class="search-intro">
    <p class="search-kicker">Find Articles Fast</p>
    <h2 class="search-heading">Live search across titles, tags, descriptions, and post content</h2>
    <p class="search-lede">
      Start typing and the list updates immediately in your browser. The index is built from the site itself, so no external search service is required.
    </p>
  </div>

  <div class="search-shell">
    <label class="search-label" for="site-search">Search the archive</label>
    <input
      id="site-search"
      class="search-input"
      type="search"
      inputmode="search"
      autocomplete="off"
      spellcheck="false"
      autofocus
      aria-describedby="search-syntax"
      placeholder="Search for Ansible, CentOS, Tor, Terraform..."
    />
    <p class="search-syntax" id="search-syntax">
      Narrow results with <code>title:linux</code> (or <code>headline:linux</code>), <code>tag:devops</code>,
      <code>content:systemd</code>, or <code>description:storage</code>. Combine filters; press <kbd>Esc</kbd> to remove focus from the search field.
    </p>
  </div>

  <div class="search-meta" id="search-meta"></div>
  <div class="search-results" id="search-results"></div>
</div>
