ASDF ?= asdf
ASDF_BIN := $(shell command -v $(ASDF) 2>/dev/null || printf '%s' "$(ASDF)")
ASDF_BIN_DIR := $(dir $(ASDF_BIN))
BUNDLER_VERSION ?= 2.4.17
RUBY_VERSION ?= $(shell awk '$$1 == "ruby" { print $$2; exit }' .tool-versions)
HOST ?= 127.0.0.1
PORT ?= 4000

export PATH := $(ASDF_BIN_DIR):$(PATH)

.DEFAULT_GOAL := help

.PHONY: help check-asdf asdf-ruby-plugin install build serve clean

help: ## Show available make targets
	@echo "Targets:"
	@awk 'BEGIN { FS = ":.*##" } /^[a-zA-Z0-9_.-]+:.*##/ { printf "  make %-12s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

check-asdf:
	@command -v $(ASDF) >/dev/null 2>&1 || { \
		echo "asdf is required. Install it first: https://asdf-vm.com/"; \
		exit 1; \
	}

asdf-ruby-plugin: check-asdf
	@$(ASDF) plugin list | grep -qx ruby || $(ASDF) plugin add ruby https://github.com/asdf-vm/asdf-ruby.git

install: asdf-ruby-plugin ## Install Ruby, Bundler, and project gems through asdf
	$(ASDF) install ruby $(RUBY_VERSION)
	$(ASDF) exec gem install bundler -v $(BUNDLER_VERSION)
	$(ASDF) reshim ruby
	$(ASDF) exec bundle config set --local path .bundle/vendor
	$(ASDF) exec bundle install

build: install ## Build the static site into _site
	$(ASDF) exec bundle exec jekyll build

serve: install ## Serve the site locally with LiveReload
	$(ASDF) exec bundle exec jekyll serve --host $(HOST) --port $(PORT) --livereload

clean: ## Remove generated Jekyll output and caches
	rm -rf _site .jekyll-cache .sass-cache
