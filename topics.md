---
layout: page
title: Topics
---

{% assign featured_topics = "Tutorials|Linux|AI|Ansible|Terraform|Security|macOS|Gentoo|CentOS" | split: "|" %}

<div class="topics-page">
  <div class="topics-intro">
    <p class="topics-kicker">Browse The Archive</p>
    <h2 class="topics-heading">Topics I write about regularly</h2>
    <p class="topics-lede">
      This page groups the blog into a smaller set of consistent topics so it is easier to find practical guides,
      Linux notes, infrastructure writeups, and the occasional AI or security deep dive.
    </p>
  </div>

  <div class="topics-grid">
    {% for topic in featured_topics %}
      {% assign posts = site.tags[topic] %}
      {% if posts and posts.size > 0 %}
        {% capture topic_description %}
          {% case topic %}
            {% when "Tutorials" %}Step-by-step walkthroughs, tooling guides, and hands-on setup articles.
            {% when "Linux" %}Distribution notes, operating system opinions, and practical platform work.
            {% when "AI" %}Local AI, model-serving experiments, and applied assistant workflows.
            {% when "Ansible" %}Automation patterns, dynamic inventory ideas, and real operations glue.
            {% when "Terraform" %}Infrastructure as code, composition, and cloud provisioning workflows.
            {% when "Security" %}Operational security, secrets handling, and defensive workflow improvements.
            {% when "macOS" %}Apple platform workflows, networking, and the tradeoffs of the ecosystem.
            {% when "Gentoo" %}Focused Gentoo notes and distro-specific installation or packaging details.
            {% when "CentOS" %}CentOS Stream commentary and production-oriented Linux platform discussion.
          {% endcase %}
        {% endcapture %}
        <a class="topic-card" href="#{{ topic | slugify }}">
          <span class="topic-card-count">{{ posts.size }} {% if posts.size == 1 %}post{% else %}posts{% endif %}</span>
          <h3>{{ topic }}</h3>
          <p>{{ topic_description | strip }}</p>
        </a>
      {% endif %}
    {% endfor %}

    {% assign sorted_tags = site.tags | sort %}
    {% for tag in sorted_tags %}
      {% assign topic = tag[0] %}
      {% unless featured_topics contains topic %}
        <a class="topic-card topic-card-compact" href="#{{ topic | slugify }}">
          <span class="topic-card-count">{{ tag[1].size }} {% if tag[1].size == 1 %}post{% else %}posts{% endif %}</span>
          <h3>{{ topic }}</h3>
          <p>Additional writing collected under this tag.</p>
        </a>
      {% endunless %}
    {% endfor %}
  </div>

  <div class="topics-section-list">
    {% for topic in featured_topics %}
      {% assign posts = site.tags[topic] %}
      {% if posts and posts.size > 0 %}
        {% capture topic_description %}
          {% case topic %}
            {% when "Tutorials" %}Step-by-step guides that prioritize practical outcomes over theory.
            {% when "Linux" %}Linux opinions, distro notes, and day-to-day systems work.
            {% when "AI" %}Applied AI work, local model experiments, and assistant-oriented projects.
            {% when "Ansible" %}Automation patterns and inventory ideas from practical operations work.
            {% when "Terraform" %}Cloud provisioning and infrastructure composition with Terraform.
            {% when "Security" %}Security workflows, secrets handling, and operational hardening.
            {% when "macOS" %}macOS workflows, networking details, and ecosystem tradeoffs.
            {% when "Gentoo" %}Gentoo-specific installation notes and packaging details.
            {% when "CentOS" %}CentOS Stream discussion with a production and platform lens.
          {% endcase %}
        {% endcapture %}
        <section class="topic-section" id="{{ topic | slugify }}">
          <div class="topic-section-header">
            <p class="topic-section-count">{{ posts.size }} {% if posts.size == 1 %}post{% else %}posts{% endif %}</p>
            <h2>{{ topic }}</h2>
            <p>{{ topic_description | strip }}</p>
          </div>

          <div class="topic-post-list">
            {% assign sorted_posts = posts | sort: "date" | reverse %}
            {% for post in sorted_posts %}
              {% assign read_time = post.content | number_of_words | divided_by: 180 %}
              {% if read_time < 1 %}
                {% assign read_time = 1 %}
              {% endif %}
              <article class="topic-post-card">
                <p class="topic-post-meta">
                  <span>{{ post.date | date: "%B %-d, %Y" }}</span>
                  <span>&middot;</span>
                  <span>{{ read_time }} min read</span>
                </p>
                <h3><a href="{{ post.url | absolute_url }}">{{ post.title }}</a></h3>
                <p class="topic-post-excerpt">{{ post.excerpt | strip_html | normalize_whitespace | truncate: 180 }}</p>
                <p class="topic-post-tags">
                  {% for post_tag in post.tags %}
                    <span>{{ post_tag }}</span>
                  {% endfor %}
                </p>
              </article>
            {% endfor %}
          </div>
        </section>
      {% endif %}
    {% endfor %}

    {% for tag in sorted_tags %}
      {% assign topic = tag[0] %}
      {% unless featured_topics contains topic %}
        <section class="topic-section topic-section-compact" id="{{ topic | slugify }}">
          <div class="topic-section-header">
            <p class="topic-section-count">{{ tag[1].size }} {% if tag[1].size == 1 %}post{% else %}posts{% endif %}</p>
            <h2>{{ topic }}</h2>
            <p>Everything currently filed under this topic.</p>
          </div>

          <div class="topic-post-list">
            {% assign sorted_posts = tag[1] | sort: "date" | reverse %}
            {% for post in sorted_posts %}
              {% assign read_time = post.content | number_of_words | divided_by: 180 %}
              {% if read_time < 1 %}
                {% assign read_time = 1 %}
              {% endif %}
              <article class="topic-post-card">
                <p class="topic-post-meta">
                  <span>{{ post.date | date: "%B %-d, %Y" }}</span>
                  <span>&middot;</span>
                  <span>{{ read_time }} min read</span>
                </p>
                <h3><a href="{{ post.url | absolute_url }}">{{ post.title }}</a></h3>
                <p class="topic-post-excerpt">{{ post.excerpt | strip_html | normalize_whitespace | truncate: 180 }}</p>
                <p class="topic-post-tags">
                  {% for post_tag in post.tags %}
                    <span>{{ post_tag }}</span>
                  {% endfor %}
                </p>
              </article>
            {% endfor %}
          </div>
        </section>
      {% endunless %}
    {% endfor %}
  </div>
</div>
