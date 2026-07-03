---
title: "Why I Recommend asdf for Every Repository"
description: "asdf gives repositories an explicit, reviewable version declaration for the runtimes and command-line tools required to work on them."
layout: post
date: 2026-07-03 18:00:00 +0200
tags: [asdf, Developer Experience, DevOps, CLI, Tooling]
excerpt_separator: "<!--more-->"
---

Every software repository depends on tools.

Even a small project may require one particular version of Go, Node.js, Python, or another runtime. Larger repositories often add Terraform, `kubectl`, documentation generators, and code-generation tools. Without an explicit mechanism, developers install whatever their operating system provides, CI uses a different version, and the production build quietly depends on another one again.

These differences often remain invisible until a command changes behavior, a formatter rewrites files differently, or an upgrade works on one machine and fails everywhere else.

[asdf](https://asdf-vm.com/) is the tool version manager I recommend for this problem. It gives a repository one version-selection interface backed by one small file: `.tool-versions`. The file can be committed to Git, reviewed like any other dependency change, and used by developers and CI to install the same declared versions.

asdf does not make an environment perfectly reproducible, and it is not a replacement for a package manager or a container image. It solves a narrower problem extremely well: selecting and installing the versions of project tools that should be active in a directory.

<!--more-->

## Version Drift Is a Repository Problem

Teams often treat tool versions as workstation configuration.

The onboarding guide says to install "a recent Node.js." A CI image happens to contain Terraform. One engineer upgrades Python through a package manager. Another keeps an old version because a different project still depends on it. The repository itself never states what it expects.

That model fails because tool versions are part of the build input.

A compiler version can change generated code. A formatter can produce a different diff. A deployment CLI may add or remove flags. A runtime upgrade can change dependency resolution or language behavior. Even when two releases are nominally compatible, relying on an unspecified version makes failures harder to reproduce.

The repository should therefore answer:

- Which tools are required?
- Which exact versions are expected?
- How does a developer install them?
- How does CI use the same versions?
- How is an upgrade reviewed?

asdf gives those questions a consistent answer without requiring a separate version manager for every ecosystem.

## One Tool Is Enough to Justify It

The case for asdf does not begin only when a repository becomes polyglot.

If a project depends on one versioned runtime, declaring that version is already valuable. A Node.js repository should not require contributors to infer the supported version from a CI image. A Go repository should not rely on whichever compiler a workstation package manager installed. A Python project should not discover interpreter drift only after a dependency fails to build.

A minimal `.tool-versions` file can contain one line:

```text
golang 1.24.1
```

That line makes the expected compiler version visible, reviewable, and installable. It also establishes a consistent mechanism if the repository later adds a formatter, infrastructure CLI, or documentation tool.

Not every contributor must use asdf for the declaration to be useful. Other automation can parse or mirror the version, and developers using another version manager can still see the repository's expectation. The important improvement is that the version belongs to the project rather than to an individual's workstation.

## One Interface, Many Plugins

asdf core manages version selection, installation locations, and executable shims. Tool-specific behavior lives in plugins.

A Node.js plugin knows how to list and install Node.js releases. A Python plugin handles Python. Other plugins support tools such as Terraform, Go, Java, Ruby, Elixir, and many operational CLIs.

The command interface stays consistent:

```shell
asdf plugin add nodejs
asdf plugin add python
asdf plugin add terraform

asdf list all nodejs
asdf install nodejs 22.14.0
asdf set nodejs 22.14.0
```

The versions in this article are illustrative. A repository should select versions based on its own support and update policy.

The consistency matters. Without asdf, the equivalent workflow may involve `nvm`, `pyenv`, a package-manager tap, a manually downloaded Terraform archive, and several different configuration files. Each tool can work well individually, but the combined onboarding and maintenance cost grows with every runtime.

asdf reduces that surface to a plugin system and a common set of commands.

## How `.tool-versions` Works

`.tool-versions` is the correct filename. It is a plain text file with one tool and version declaration per line:

```text
nodejs 22.14.0
python 3.12.9
terraform 1.11.0
golang 1.24.1
```

I commit this file at the root of the repository.

After cloning the project and adding the required plugins, a developer can install every declared version with:

```shell
asdf install
```

Running `asdf install` without arguments reads the active `.tool-versions` file and installs all listed tools. To install only one declared tool:

```shell
asdf install terraform
```

The file can be edited directly, but the current command for updating it is `asdf set`:

```shell
asdf set nodejs 22.14.0
asdf set python 3.12.9
```

By default, `asdf set` writes to `.tool-versions` in the current directory and creates the file when necessary.

Older articles often use:

```text
asdf local
asdf global
```

Those commands belonged to asdf 0.15 and earlier. Modern asdf releases replaced them with `asdf set`. Use `asdf set --home` to write a default into `$HOME/.tool-versions`, or `asdf set --parent` to update the closest existing `.tool-versions` in a parent directory:

```shell
asdf set --home nodejs 22.14.0
asdf set --parent terraform 1.11.0
```

The new names are more accurate. A version in the home directory is not truly global; a closer project file can override it.

## Directory-Based Version Resolution

asdf resolves a tool version when its shim is executed.

The shim directory appears near the front of `PATH`. When I run:

```shell
terraform version
```

the `terraform` shim asks asdf which version applies to the current directory, locates the corresponding installation, prepares any plugin-defined environment, and executes the real binary.

asdf looks for version declarations from the current working directory upward toward the home directory. A project-level `.tool-versions` therefore overrides a home-level default.

For example:

```text
~/.tool-versions
~/code/legacy-service/.tool-versions
~/code/new-service/.tool-versions
```

My home file may declare a reasonable default Node.js version. Entering `legacy-service` selects the older release required there, while entering `new-service` selects its newer release. There is no manual "activate this project" command.

Inspect the active resolution with:

```shell
asdf current
```

For one tool:

```shell
asdf current nodejs
```

To see the actual executable behind a command:

```shell
asdf which node
```

These commands are valuable when debugging `PATH` problems or discovering that a declared version has not been installed.

## Exact Versions Make Upgrades Visible

asdf expects exact tool versions. The `latest` keyword is a convenience for resolving a current release, but the useful outcome is still a concrete version.

For example:

```shell
asdf set nodejs latest:22
```

The plugin resolves the latest release matching the requested series and writes an exact version to `.tool-versions`.

This is better than committing:

```text
nodejs latest
```

or documenting "Node 22 or newer." An exact declaration makes changes visible in code review:

```diff
-nodejs 22.14.0
+nodejs 22.17.0
```

That diff can trigger the appropriate pipeline, release-note review, compatibility testing, and coordinated update to CI or production images.

Tool upgrades are dependency upgrades. They deserve the same visibility as a library or base-image change.

## More Than Numeric Versions

The common `.tool-versions` entry uses a release number, but asdf supports other selectors.

The special value `system` delegates to the executable installed outside asdf:

```text
python system
```

A `ref:` value can identify a plugin-supported source reference:

```text
elixir ref:v1.18.0
```

A `path:` value can point to a locally built tool:

```text
elixir path:~/src/elixir
```

Multiple versions may also be listed as fallbacks on one line:

```text
python 3.12.9 3.11.11 system
```

These capabilities are useful, but exact single versions are the clearest choice for most team repositories. Local paths are inherently machine-specific, and a system fallback weakens reproducibility. Use them deliberately rather than as defaults.

Comments are supported:

```text
# Runtime used by the application and build pipeline
nodejs 22.14.0

# Keep this aligned with the production automation image
terraform 1.11.0
```

Comments should explain constraints that are not obvious from the version number. They should not become a substitute for an upgrade policy.

## A Practical Repository Workflow

My preferred workflow is:

1. Select trusted plugins for the required tools.
2. Commit `.tool-versions` at the repository root.
3. Run `asdf install` during workstation setup.
4. Run `asdf current` when diagnosing version problems.
5. Use the same file in CI.
6. Upgrade versions through ordinary reviewed changes.

A setup section can remain short:

```shell
asdf plugin add nodejs
asdf plugin add python
asdf plugin add terraform
asdf install
```

If the organization manages plugins centrally, the bootstrap script can own the `plugin add` step. This is often preferable because `.tool-versions` declares tool versions, but it does not declare plugin repository revisions.

That distinction is important.

## Plugin Trust Is Part of the Supply Chain

asdf plugins execute code to discover, download, build, and install tools. They are part of the development supply chain.

Before standardizing a plugin, I want to know:

- who maintains it
- where it downloads artifacts from
- whether it verifies signatures or checksums
- which build dependencies it requires
- how releases and breaking changes are handled
- whether the organization needs to pin or mirror it

The public plugin ecosystem is a major strength of asdf, but popularity is not a security review.

An organization can add plugins by an explicit repository URL:

```shell
asdf plugin add nodejs https://github.com/asdf-vm/asdf-nodejs.git
```

For stricter environments, bootstrap automation can pin approved plugin revisions, use internal mirrors, and cache upstream tool artifacts. The repository's `.tool-versions` remains useful, but it should be understood as one part of a controlled installation path.

## CI Should Read the Same File

The strongest value of `.tool-versions` appears when local development and CI consume the same declaration.

A generic CI sequence is:

```shell
asdf plugin add nodejs
asdf plugin add python
asdf plugin add terraform
asdf install

node --version
python --version
terraform version
```

The exact asdf installation and cache configuration depend on the CI platform. The principle does not: avoid copying tool versions into workflow files when the repository already declares them.

CI caches can preserve downloaded source archives and installed versions, but cache keys should account for `.tool-versions`, the operating system, architecture, and relevant plugin state. A cache is an optimization, not the source of truth.

Production images should also align with the repository declarations where those tools are part of the runtime or build. asdf does not automatically guarantee this alignment; the pipeline must enforce or test it.

## Do Fully Containerized Workflows Still Need asdf?

Not necessarily.

If a repository is genuinely containerized end to end, the container image can be the complete tool-version boundary. That means development, formatting, linting, tests, code generation, builds, and infrastructure commands all run through a pinned image. CI uses the same image, and developers do not invoke project tools directly from the host.

In that model, adding the same versions to `.tool-versions` may create a second source of truth:

```text
.tool-versions
Dockerfile
```

If the two declarations drift, the repository is less clear than before. The team must now decide whether the asdf version or the container version is authoritative.

A well-designed container-only workflow can therefore make asdf unnecessary. The image reference or digest pins not only the main executable but also operating-system libraries and other dependencies that asdf does not manage. That is a stronger environment boundary.

The important word is *genuinely*.

Many repositories are described as containerized even though developers still run some of these commands on the host:

- formatters and linters through editor integrations
- language servers
- `pre-commit` hooks
- code generators
- package-manager commands
- database migration tools
- cloud and Kubernetes CLIs
- diagnostic commands during incidents

If host execution remains part of the supported workflow, the host tool versions still need an answer. asdf can provide it.

Containers and asdf are not mutually exclusive, but their responsibility boundary should be explicit. A repository might use containers for the application build and asdf for host-side operational tools. Another might make the development container authoritative and omit `.tool-versions` entirely. Both are coherent designs.

What I would avoid is maintaining both mechanisms automatically without stating which one owns each tool.

## Infrastructure Tooling Keeps Version Management Relevant

Infrastructure repositories are where I expect host-side version management to remain especially useful.

Tools such as OpenTofu, Terraform, `kubectl`, Helm, Kustomize, SOPS, and cloud-provider CLIs are frequently invoked directly from a terminal. Running them in containers is possible, but it often requires mounting and translating a substantial part of the host environment:

- the repository and working directory
- cloud credentials
- `KUBECONFIG`
- SSH agent sockets
- GPG or age keys
- plugin and provider caches
- certificate stores
- network and VPN access
- terminal input and output
- file ownership and permissions

A carefully designed wrapper can handle these mounts. At some point, however, the wrapper becomes more complex than installing the pinned CLI locally.

asdf keeps the native workflow:

```shell
tofu plan
kubectl diff -f deployment/
helm template ./chart
```

while allowing the repository to select the expected versions:

```text
opentofu 1.10.0
kubectl 1.32.0
helm 3.17.0
```

These versions are illustrative, not a recommendation for current production releases.

Version consistency matters for infrastructure tools. Different OpenTofu versions can change validation, provider behavior, lock-file output, plan rendering, or supported language features. Different Kubernetes client versions may expose different APIs and compatibility behavior. A formatting-only difference can create noisy pull requests; a behavioral difference can affect a deployment.

That does not mean infrastructure CLIs must run on the host. An organization with a disciplined, pinned infrastructure-toolbox image may prefer the container boundary. It means the cost-benefit calculation often favors a lightweight native version manager because infrastructure work interacts so heavily with host identity, credentials, files, and networks.

For my workflow, that practical advantage makes asdf likely to remain relevant even where application builds are fully containerized.

## `mise` Is a Credible Alternative

[`mise`](https://mise.jdx.dev/) is another tool and runtime version manager worth knowing about.

It can read asdf-style `.tool-versions` files, automatically select tools by directory, and use asdf plugins when necessary. It also provides its own `mise.toml` format and expands into areas such as environment management and task execution.

The overlap makes `mise` a credible alternative rather than an unrelated product. A repository can use `.tool-versions` as a relatively tool-neutral declaration while different contributors use asdf or mise.

That compatibility has limits. Modern asdf and mise do not have identical commands or configuration semantics, and full compatibility is not a continuing design goal for mise. For example, mise may allow fuzzy version declarations that asdf cannot use unless versions are pinned explicitly.

I have not evaluated mise deeply enough in real projects to recommend it over asdf. Its broader feature set, performance model, tool backends, supply-chain approach, and Windows support are all reasonable subjects for an evaluation. They are not a basis for pretending I already have operational experience I do not have.

For now, asdf remains the tool I know, use, and recommend. Teams selecting a version manager today should still compare both against their actual requirements instead of treating my preference as a universal conclusion.

## What asdf Does Not Solve

asdf is a version manager, not a complete environment manager.

It does not guarantee:

- operating-system package versions
- native libraries and compiler dependencies
- identical CPU architecture
- container base-image contents
- environment variables and credentials
- external service behavior
- deterministic downloads from every plugin

The official documentation explicitly distinguishes asdf from systems such as Nix, which can model a much larger dependency graph.

Containers, Nix, Devbox, or hermetic build systems may be the better answer when the complete environment must be reproducible. asdf remains useful when the immediate problem is selecting project CLIs and runtimes on developer workstations and in conventional CI jobs.

It also does not remove tool-specific knowledge. A Python build may still require system headers. A Node.js plugin may require signature tooling. A language runtime may take significant time to compile. The plugin documentation remains part of setup.

## Modern asdf Is Different from Old Tutorials

asdf 0.16 was a complete rewrite from shell scripts to a Go binary. Current installations no longer source the old `asdf.sh` implementation, and the command set changed.

For a new installation, follow the [current getting-started guide](https://asdf-vm.com/guide/getting-started.html), install the asdf binary through an approved package or release mechanism, and place the asdf shim directory near the front of `PATH`.

Do not copy an old Git-clone-and-source setup without checking its target version. In particular:

- use `asdf set`, not `asdf local` or `asdf global`
- use spaced subcommands such as `asdf plugin add`, not `asdf plugin-add`
- update the asdf binary through its installation mechanism, not `asdf update`

The `.tool-versions` model remains familiar, but the modern core is operationally simpler.

## One Small File Removes a Large Class of Ambiguity

I recommend asdf because it gives repositories an explicit, reviewable answer to tool-version drift.

It replaces several version-manager interfaces with one. It makes entering a directory enough to select the right tools. It gives onboarding and CI the same installation command. It turns upgrades into visible diffs instead of workstation accidents.

`.tool-versions` is not a lockfile for the entire machine, and asdf is not a security sandbox. Those limitations are real. A fully containerized workflow may not need it, and mise is a credible alternative worth evaluating. Within asdf's intended boundary, however, it is simple, composable, and effective.

The repository states what it needs:

```text
nodejs 22.14.0
python 3.12.9
terraform 1.11.0
```

The developer runs:

```shell
asdf install
```

That is a strong developer-experience improvement for very little configuration. One runtime is enough to benefit from explicit version selection; additional tools only increase the value of a shared interface. I recommend asdf for almost every repository that executes versioned tools on the host, while recognizing that a truly container-only workflow may already have a better source of truth.
