ASDF ?= asdf
BUNDLER_VERSION ?= 2.4.17
HOST ?= 127.0.0.1
PORT ?= 4000

.DEFAULT_GOAL := serve

.PHONY: help check-asdf asdf-ruby-plugin install build serve clean

help:
	@echo "Targets:"
	@echo "  make install  Install Ruby, Bundler, and gems through asdf"
	@echo "  make serve    Install dependencies and serve the site locally"
	@echo "  make build    Install dependencies and build the site"
	@echo "  make clean    Remove generated Jekyll output"

check-asdf:
	@command -v $(ASDF) >/dev/null 2>&1 || { \
		echo "asdf is required. Install it first: https://asdf-vm.com/"; \
		exit 1; \
	}

asdf-ruby-plugin: check-asdf
	@$(ASDF) plugin list | grep -qx ruby || $(ASDF) plugin add ruby https://github.com/asdf-vm/asdf-ruby.git

install: asdf-ruby-plugin
	$(ASDF) install
	$(ASDF) exec gem install bundler -v $(BUNDLER_VERSION)
	$(ASDF) reshim ruby
	$(ASDF) exec bundle config set --local path .bundle/vendor
	$(ASDF) exec bundle install

build: install
	$(ASDF) exec bundle exec jekyll build

serve: install
	$(ASDF) exec bundle exec jekyll serve --host $(HOST) --port $(PORT) --livereload

clean:
	rm -rf _site .jekyll-cache .sass-cache
