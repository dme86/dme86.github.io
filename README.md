# dme86.github.io

This repository contains the Jekyll source for https://dme86.github.io.

## DME theme

The site uses the custom DME theme, maintained by Daniel Meier. The theme is
derived from earlier MIT-licensed work; retained copyright and license terms
are documented in [LICENSE.md](LICENSE.md).

## Local development

The local workflow uses `make` and [asdf](https://asdf-vm.com/) so the Ruby
version, Bundler, and gems are reproducible.

### Prerequisites

Install `asdf` first. The Makefile installs the Ruby plugin, the Ruby version
from `.tool-versions`, Bundler, and the project gems.

### Start the site

```sh
make serve
```

Then open http://127.0.0.1:4000/.

`make serve` runs the full local setup first, so a fresh checkout should only
need that one command after `asdf` itself is available.

### Useful targets

```sh
make install
make build
make clean
```

- `make install` installs Ruby through asdf, installs Bundler, and installs the
  gems into `.bundle/vendor`.
- `make build` builds the static site into `_site`.
- `make clean` removes generated Jekyll output.

Generated files and local gems are ignored by Git.

## English and German articles

English remains the default language. Existing posts and their URLs stay in
`_posts`. German translations live in the separate `_de` collection and use an
explicit `permalink` under `/de/`. They do not enter the English pagination or
Atom feed. `/de/` lists the available German articles.

To add a translation, give the English post and German document the same unique
`translation_key`. Preserve the original `date` in the translation and copy its
code blocks unchanged. The `_de` collection defaults to `lang: de` and
`layout: post`; other pages default to `lang: en`.

Liquid uses the key to generate the EN | DE links and reciprocal `hreflang`
links, including `x-default` for English. Each version has its own canonical URL
and HTML language. For English articles without a translation, DE leads to the
German overview and no translated alternate is advertised. No extra plugin or
JavaScript is needed for language selection.
