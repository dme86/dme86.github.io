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
