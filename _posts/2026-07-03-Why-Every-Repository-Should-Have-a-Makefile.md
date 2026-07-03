---
title: "Why Every Repository Should Have a Makefile"
description: "A small Makefile gives developers and CI one documented interface for setup, tests, builds, and other repository workflows."
layout: post
date: 2026-07-03 19:30:00 +0200
tags: [Make, Automation, Developer Experience, DevOps, CI/CD]
excerpt_separator: "<!--more-->"
---

Every repository develops a collection of commands.

There is a command to install dependencies, another to run tests, one for formatting, one for building an artifact, and several more for local development, generated code, documentation, containers, or deployment validation. Without a common interface, those commands spread across README files, CI YAML, shell history, package-manager scripts, and team memory.

I recommend putting a Makefile in almost every repository.

Not because every project compiles C, and not because GNU Make is a modern workflow language. I recommend it because `make` provides a small, familiar, versioned entry point for repository operations. A developer can run `make`, discover the available workflows, and use the same targets that CI uses.

A good repository Makefile is not a second application hidden beside the real one. It is a thin, documented interface over commands the project already trusts.

<!--more-->

## Repositories Need an Operational Interface

A README can explain how to work with a project, but prose and execution drift apart easily.

The documentation says:

```shell
go test ./...
```

CI actually runs:

```shell
go test -race -count=1 ./...
```

The release job adds environment variables and code generation. One developer remembers all of it. Everyone else copies the last successful command from shell history.

This is an interface problem.

A repository should expose stable operations with memorable names:

```shell
make install
make format
make lint
make test
make build
make clean
```

The implementation can change without forcing every person and CI workflow to learn the new command immediately. If a project moves from one linter to another, `make lint` remains the interface.

That stability is valuable even in a small repository. It becomes essential when several languages, generators, containers, or platform tools are involved.

## Why Make Is Still a Strong Choice

GNU Make is old, but age is not the relevant property. Its useful properties are:

- it is widely available
- the basic rule syntax is small
- targets are easy to invoke and compose
- prerequisites can express dependencies
- command-line variables make targets configurable
- the Makefile is ordinary versioned text
- developers and CI can call the same interface

Many ecosystems have their own task runners. `npm run`, Cargo aliases, Gradle, Maven, Poetry, and language-specific build tools can all be appropriate. A Makefile does not need to replace them. It can provide the repository-level interface that calls them.

For example:

```make
.PHONY: test
test:
	npm test
```

The value is not the one-line wrapper by itself. The value is that a polyglot repository can expose `make test` regardless of whether a component uses Node.js, Go, Python, Terraform, or several of them together.

## The Smallest Useful Makefile

A practical starting point looks like this:

```make
.DEFAULT_GOAL := help

.PHONY: help install format lint test build clean

help: ## Show available targets
	@awk 'BEGIN { FS = ":.*##" } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  make %-16s %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)

install: ## Install project dependencies
	go mod download

format: ## Format source files
	go fmt ./...

lint: ## Run static analysis
	golangci-lint run

test: ## Run the test suite
	go test ./...

build: ## Build the application
	mkdir -p .build
	go build -o .build/app ./cmd/app

clean: ## Remove generated build output
	rm -rf .build
```

Running `make` produces:

```text
  make help             Show available targets
  make install          Install project dependencies
  make format           Format source files
  make lint             Run static analysis
  make test             Run the test suite
  make build            Build the application
  make clean            Remove generated build output
```

This gives the repository self-documenting entry points without maintaining a separate target list.

## Make `help` the Explicit Default

By default, Make chooses the first eligible target in the first rule as its goal when no target is provided.

That means this:

```shell
make
```

normally executes whichever target happens to appear first.

Relying on source order is fragile. Adding an include or moving a rule can change the default behavior. It is also risky when the first target builds, publishes, deploys, or modifies files.

Set the default explicitly:

```make
.DEFAULT_GOAL := help
```

Now plain `make` always invokes the `help` target.

I prefer help as the default because an unqualified command should be safe and informative. It gives new contributors immediate orientation and prevents accidental work when somebody runs `make` only to see what the repository supports.

Some build-focused projects reasonably use `all` or `build` as the default. The important point is to choose deliberately with `.DEFAULT_GOAL` instead of depending on rule order.

## Document Targets Beside Their Definitions

The `##` convention keeps the user-facing description on the target line:

```make
test: ## Run the test suite
	go test ./...
```

The first `#` begins a Makefile comment. The second is simply part of the convention, making documentation comments distinguishable from ordinary implementation comments.

The help recipe reads the Makefiles from disk and selects target lines containing `##`:

```make
help: ## Show available targets
	@awk 'BEGIN { FS = ":.*##" } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  make %-16s %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)
```

The pieces are straightforward.

`$(MAKEFILE_LIST)` is a Make variable containing the names of the Makefiles parsed so far. This also allows documented targets from included Makefiles to appear in help output.

The `awk` field separator:

```text
:.*##
```

splits each matching line into:

- the target name before the colon
- the description after `##`

The regular expression:

```text
^[a-zA-Z0-9_.-]+:.*##
```

limits output to simple documented target names. Internal rules without `##` stay out of the user-facing list.

The doubled dollar signs in `$$1` and `$$2` are essential. Make consumes dollar signs for its own variable syntax. Writing `$$` passes one literal `$` to the shell, allowing `awk` to receive its normal `$1` and `$2` field references.

The `@` before `awk` prevents Make from printing the implementation command itself. The user sees only the formatted help.

This convention is not built into GNU Make. It is a small, understandable pattern implemented with standard Make variables and `awk`.

## Use `.PHONY` for Actions

Make was designed around files and timestamps. A target is normally considered up to date when a file with that name exists and its prerequisites are not newer.

Action targets such as `test` and `clean` do not represent files. Declare them phony:

```make
.PHONY: help format lint test clean
```

Without that declaration, a file or directory named `test` could cause `make test` to report that nothing needs to be done.

`.PHONY` tells Make that these names are actions and should run when requested. It also avoids unnecessary implicit-rule searches.

Generated artifacts should remain real targets when timestamps and dependencies are useful:

```make
.build/app: $(shell find cmd internal -name '*.go') go.mod go.sum
	mkdir -p $(@D)
	go build -o $@ ./cmd/app

.PHONY: build
build: .build/app ## Build the application
```

Here, `.build/app` is a real file target. `build` is the human-facing action.

Not every repository needs this level of dependency modeling. A thin task-oriented Makefile is already valuable. Use Make's build graph where it improves correctness rather than forcing every command into it.

## Make Targets Should Be Thin

A Makefile becomes difficult to maintain when it grows into a shell application with deeply nested conditionals, platform detection, and long inline scripts.

Prefer:

```make
.PHONY: release
release: ## Build and validate a release artifact
	./scripts/release
```

over hundreds of lines of release logic inside the recipe.

The script can be tested, linted, and executed independently. The Make target provides discoverability and a stable entry point.

My rule is:

- short command composition belongs in the Makefile
- complex control flow belongs in a script or application
- Make owns the interface and dependency relationship
- the underlying tools own their domain logic

This keeps `make help` useful without making the Makefile the hardest program in the repository to debug.

## Use Variables for Legitimate Configuration

Make variables let callers adjust a target without editing the file:

```make
HOST ?= 127.0.0.1
PORT ?= 8080

.PHONY: serve
serve: ## Run the local development server
	go run ./cmd/app --host $(HOST) --port $(PORT)
```

The `?=` operator assigns a default only when the variable has not already been set.

The default invocation is:

```shell
make serve
```

A caller can override one value:

```shell
make serve PORT=9090
```

CI can use the same target with its own environment.

Keep variables explicit and documented. A target controlled by twenty undocumented variables is not a stable interface; it is a configuration language the team must reverse-engineer.

## Compose Workflows with Prerequisites

Phony targets can depend on other phony targets:

```make
.PHONY: check format-check lint test

check: format-check lint test ## Run all required checks
```

Now:

```shell
make check
```

runs the repository's required validation set.

CI can call `make check` instead of reproducing every command in pipeline YAML. When the project adds a linter, the Makefile changes and the pipeline interface remains stable.

Be careful with assumptions about ordering. Prerequisites describe dependencies, and parallel Make may execute independent prerequisites concurrently. If steps must happen in a strict sequence or share mutable state, model the dependency accurately or place the sequence in one script.

The target graph is useful when it expresses reality. It is harmful when used as decorative syntax around unrelated commands.

## A Makefile Pairs Well with asdf

A Makefile defines how to work with the repository. [asdf](/2026/07/03/Why-I-Recommend-asdf-for-Multi-Tool-Repositories/) can define which versions of those tools to use.

A repository may contain:

```text
.tool-versions
Makefile
```

with:

```make
.PHONY: tools
tools: ## Install tool versions declared by the repository
	asdf install
```

The division is clean:

- `.tool-versions` declares versioned tool dependencies
- asdf installs and selects them
- the Makefile exposes repository workflows

A new developer can run:

```shell
make
make tools
make install
make check
```

This does not eliminate prerequisite documentation—asdf itself and Make still need to be available—but it makes the path after bootstrap predictable.

## CI Should Call the Same Targets

One of the strongest reasons to use a Makefile is eliminating command duplication between local development and CI.

Instead of embedding:

```yaml
- run: gofmt ...
- run: golangci-lint ...
- run: go test ...
```

the pipeline calls:

```yaml
- run: make check
```

The exact CI syntax depends on the provider, but the responsibility boundary should be consistent:

- CI defines credentials, caches, runners, artifacts, and job orchestration
- the repository defines how it formats, lints, tests, and builds itself

This lets developers reproduce a failed step locally without translating pipeline YAML into shell commands.

It also reduces vendor lock-in. Moving between CI systems still requires work, but the core repository operations are not buried inside one provider's workflow language.

## Common Makefile Mistakes

### Forgetting Recipe Tabs

Traditional Make syntax requires recipe lines to begin with a tab:

```make
test:
	go test ./...
```

Spaces can produce the familiar "missing separator" error. Editors should preserve tabs in Makefiles.

### Hiding Every Command

Prefixing every recipe with `@` creates clean output until something fails and nobody can see what ran. Hide implementation details where appropriate, such as the help formatter, but keep operational commands visible unless the script already logs them clearly.

### Depending on Shell-Specific Syntax Accidentally

Make recipes normally use `/bin/sh`. A recipe copied from an interactive Bash or Fish session may not work.

Use portable shell syntax for small recipes. If a script requires Bash, make that explicit in the script's shebang and call the script from Make.

### Forgetting That Each Recipe Line Uses a Shell

Separate recipe lines may run in separate shell processes:

```make
broken:
	cd subdirectory
	run-something
```

The second line should not be assumed to retain the first line's working directory. Write:

```make
working:
	cd subdirectory && run-something
```

or move the workflow into a script.

### Reimplementing the Package Manager

A Makefile should call `go`, `npm`, `cargo`, `helm`, or another authoritative tool. It should not reproduce their dependency logic.

### Running Destructive Work by Default

Plain `make` should not publish, deploy, delete, or mutate external systems. A default help target is a safe design.

## Makefiles Are Executable Repository Documentation

A useful Makefile explains the supported workflow through executable targets.

The target:

```make
test: ## Run the test suite
```

is simultaneously:

- a command developers can invoke
- an interface CI can depend on
- a discoverable help entry
- a reviewed statement of repository capability

That combination is stronger than a command copied into three documents.

The Makefile still needs ownership. Targets must be kept current. Help descriptions must be specific. Deprecated workflows should be removed. A broken `make test` damages trust quickly because the file claims to be the standard interface.

Small, reliable Makefiles are better than comprehensive, neglected ones.

## Give Every Repository One Obvious Front Door

I recommend a Makefile for almost every repository because it gives the project a predictable operational front door.

Run:

```shell
make
```

and receive a list of supported actions. Run:

```shell
make check
```

and execute the same checks required by CI. Run:

```shell
make build
```

and build the real artifact without reconstructing flags from pipeline configuration.

The core pattern is small:

```make
.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN { FS = ":.*##" } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  make %-16s %s\n", $$1, $$2 }' \
		$(MAKEFILE_LIST)
```

Add documented targets with:

```make
target: ## Explain what the target does
	command
```

That is enough to make repository workflows discoverable, consistent, and reusable across humans and automation.

Make is not fashionable, and it does not need to be. It is a durable tool for expressing a small interface over repeatable work. Used with restraint, that is exactly what most repositories need.
