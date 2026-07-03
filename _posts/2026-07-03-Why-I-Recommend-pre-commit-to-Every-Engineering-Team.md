---
title: "Why I Recommend pre-commit to Every Engineering Team"
description: "pre-commit turns repository checks into fast, versioned feedback that developers can run locally and CI can enforce consistently."
layout: post
date: 2026-07-03 16:00:00 +0200
tags: [Git, DevOps, CI/CD, Developer Experience, Automation]
excerpt_separator: "<!--more-->"
---

Many code-review comments should never have required a reviewer.

Trailing whitespace, malformed YAML, forgotten generated files, unresolved merge markers, inconsistent formatting, accidentally committed private keys, and files that fail the repository's standard lint command are mechanical problems. Discovering them after a push wastes CI capacity and interrupts the developer after the relevant context has already started to fade.

I use [pre-commit](https://pre-commit.com/) every day because it moves this feedback to the point where it is cheapest to act on: before the commit leaves my machine. More importantly, it turns local checks into versioned repository configuration instead of relying on every developer to assemble and maintain the same toolchain manually.

That does not make CI unnecessary, and it does not turn a client-side Git hook into a security boundary. It creates a fast, reproducible feedback layer shared by developers and automation. Used with discipline, that small layer removes a surprising amount of friction from daily engineering.

<!--more-->

## The Problem Is Not a Lack of Linters

Most engineering organizations already have enough checking tools.

They have formatters, linters, schema validators, security scanners, generators, unit tests, policy scripts, and build commands. The problem is that these tools are often executed inconsistently:

- one developer has the formatter integrated into an editor
- another runs it manually before opening a pull request
- a third uses a different tool version
- CI runs the authoritative command several minutes after every push
- an onboarding document lists setup steps that have not been updated
- a repository contains useful scripts that nobody remembers to call

The result is predictable. Pull requests contain avoidable noise. CI fails for reasons that could have been reported in seconds. Reviewers spend attention on formatting and file hygiene instead of behavior and design. Teams gradually stop trusting their local setup because CI is the only place where the complete policy is visible.

`pre-commit` solves the orchestration problem.

The repository contains a `.pre-commit-config.yaml` file that declares which hooks run and which versions to use. Developers install one Git hook. `pre-commit` then prepares the required environments, selects the relevant staged files, and executes the configured checks.

The framework is named after the Git hook where it is most commonly used, but it supports more than the `pre-commit` stage. Hooks can run at `pre-push`, `commit-msg`, and other Git lifecycle points, or be invoked manually and in CI.

This gives the team one answer to a basic question:

> What should I run before this change is considered mechanically valid?

The answer lives in the repository instead of in tribal knowledge.

## Fast Feedback Changes the Development Loop

A good development loop is short:

1. make a change
2. receive specific feedback
3. correct the problem
4. continue while the context is still fresh

Waiting for a remote pipeline expands that loop. Even a five-minute CI job is expensive when the failure is a formatting difference or invalid YAML on line 14. The developer must switch back to the branch, reconstruct the context, amend the change, push again, and wait for another pipeline.

With `pre-commit`, the same failure appears during `git commit`:

```text
Check Yaml...............................................................Failed
```

Some hooks report a problem. Others safely rewrite files. When a formatter changes a staged file, the commit stops so I can inspect the result, stage it again, and retry. This is an important property: automation can make the mechanical correction without silently changing the contents of a commit after I approved it.

Hooks normally run only against relevant staged files. That keeps the common path fast and makes the result specific to the change being committed.

When adding a hook or checking the complete repository, I run:

```shell
pre-commit run --all-files
```

To run one hook:

```shell
pre-commit run check-yaml --all-files
```

This is simple enough to become routine, which is why I use it daily rather than treating it as occasional repository maintenance.

## Reproducible Tooling Without One Giant Development Image

One of the strongest features of `pre-commit` is environment management.

A hook repository declares how its hook is installed and executed. Depending on the hook, `pre-commit` can create an isolated environment for Python, Node.js, Ruby, Rust, Go, and other ecosystems. The first run may take longer because the environment must be created, but later runs reuse the cache.

This has several benefits:

- hook versions are pinned in the repository
- developers do not need to install every linter globally
- different repositories can use different tool versions
- CI can execute the same configuration as a workstation
- hook dependencies do not all need to share one environment

It is not perfect hermeticity. Hooks can still depend on platform behavior, external executables, network access, or system libraries. A `language: system` hook deliberately uses tools already installed on the machine. Teams should understand those boundaries instead of assuming that every hook is reproducible by definition.

Still, it is a substantial improvement over a README containing twelve global installation commands.

## Installing It Should Be Part of Repository Setup

The basic setup is intentionally small.

Install `pre-commit` through the package mechanism used for development tools in the organization, then run:

```shell
pre-commit install
```

That installs the Git hook into the current repository. I then verify the complete configuration once:

```shell
pre-commit run --all-files
```

For organizations managing developer bootstrap centrally, `pre-commit init-templatedir` can install the hook through Git's template directory so newly created and cloned repositories are prepared automatically:

```shell
git config --global init.templateDir ~/.git-template
pre-commit init-templatedir ~/.git-template
```

This improves adoption, but it should not be the enforcement mechanism. Developers can bypass local hooks, work from an environment without them, or invoke Git with `--no-verify`.

CI must run the checks as well.

A provider-neutral CI step is simply:

```shell
pre-commit run --all-files --show-diff-on-failure
```

The local hook optimizes feedback. CI establishes the required result for merging. Using the same configuration in both places prevents the common situation where "local lint" and "CI lint" are similar but not actually identical.

## Example 1: A Baseline for Every Repository

The first company-wide use case should be boring, fast, and broadly applicable.

Create `.pre-commit-config.yaml` in a repository:

```yaml
minimum_pre_commit_version: "4.0.0"

repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-json
      - id: check-toml
      - id: check-merge-conflict
      - id: check-added-large-files
      - id: detect-private-key
```

This baseline catches several common failure classes:

- whitespace and missing final newlines
- invalid YAML, JSON, and TOML syntax
- merge-conflict markers left in a file
- unexpectedly large files
- recognizable private-key material

The hooks are useful across application, infrastructure, documentation, and platform repositories. They are also fast enough to run on every commit without turning the hook into a reason to reach for `--no-verify`.

After adding the configuration:

```shell
pre-commit install
pre-commit run --all-files
```

The initial all-files run may modify many old files. Handle that as a dedicated cleanup change instead of mixing it into unrelated product work. Once the baseline is clean, future commits pay only the incremental cost.

The `rev` is deliberately pinned. Hook code executes on developer machines and in CI, so updates should be treated as dependency changes. `pre-commit autoupdate` can update configured hooks:

```shell
pre-commit autoupdate
pre-commit run --all-files
```

The resulting diff should be reviewed and tested like any other tooling update. Organizations with stricter supply-chain requirements may pin immutable commit hashes using `pre-commit autoupdate --freeze`.

`detect-private-key` deserves an explicit warning: it is a useful early check, not a complete secret-scanning system. It will not identify every token, password, connection string, or organization-specific credential. Server-side secret scanning, credential revocation procedures, and repository protection remain necessary.

This example works because it sets a modest baseline with a high signal-to-cost ratio. It should be the beginning of repository policy, not an attempt to encode every engineering standard on the first day.

## Example 2: Run Existing Company Checks Consistently

Most companies already have repository-specific scripts such as:

```shell
./scripts/check-service-metadata
make check-generated
make lint
```

The scripts may be correct and useful, but their value is limited if developers discover them only after CI fails.

`pre-commit` can call existing commands as local hooks:

```yaml
repos:
  - repo: local
    hooks:
      - id: service-metadata
        name: Validate service metadata
        entry: ./scripts/check-service-metadata
        language: script
        files: ^service\.ya?ml$

      - id: generated-files
        name: Verify generated files are current
        entry: make check-generated
        language: system
        pass_filenames: false
        files: ^(api|schemas|generated)/

      - id: project-lint
        name: Run the project linter
        entry: make lint
        language: system
        pass_filenames: false
        files: ^(src|tests)/
```

This example demonstrates three useful patterns.

The metadata hook receives matching filenames because `pass_filenames` keeps its default value. The generator and project linter operate at repository level, so `pass_filenames: false` prevents `pre-commit` from appending changed paths to commands that do not accept them. The `files` patterns avoid running a repository-wide command when the change cannot affect its result.

`language: script` expects the declared script to be executable. `language: system` executes the command in the existing developer environment. That makes adoption quick, but it also means the required build tools must already be installed.

This is a reasonable first step when an organization has a standard bootstrap process. If the check should work without the repository's complete development toolchain, package it as a real hook with an appropriate managed language.

Once several repositories need the same company policy, move the hook implementation into a dedicated internal hook repository:

```yaml
repos:
  - repo: ssh://git@github.example.com/platform/company-pre-commit-hooks
    rev: v1.4.0
    hooks:
      - id: validate-service-metadata
      - id: validate-deployment-policy
```

The internal repository contains a `.pre-commit-hooks.yaml` manifest and versioned implementations. Consuming repositories pin a release. The platform or developer-experience team owns the hook contract, tests changes, publishes updates, and documents migration requirements.

This creates a scalable responsibility boundary:

- central maintainers own shared policy logic
- repository teams choose or inherit approved hooks
- versions change through visible dependency updates
- developers and CI execute the same code
- rollout can be incremental instead of changing every repository simultaneously

The centralized repository should not become a collection of opaque organizational rules. A failing hook must explain what failed, why the policy exists, and how the developer can correct or legitimately exempt the case.

## Keep the Commit Path Fast

The fastest way to make developers bypass hooks is to put an integration test suite on every commit.

The pre-commit stage should contain checks that are:

- fast
- deterministic
- local
- relevant to the changed files
- capable of producing an actionable error

Formatting, syntax validation, static checks, small policy validations, and generated-file consistency are good candidates.

Heavier tests can run at `pre-push`:

```yaml
default_install_hook_types:
  - pre-commit
  - pre-push

repos:
  - repo: local
    hooks:
      - id: fast-integration-tests
        name: Run fast integration tests
        entry: make test-integration-fast
        language: system
        pass_filenames: false
        stages:
          - pre-push
```

CI must invoke any required non-default stage explicitly. For example:

```shell
pre-commit run --all-files --hook-stage pre-push
```

Long-running, network-dependent, privileged, or environment-specific tests usually belong only in CI. A local hook should shorten the feedback loop, not recreate the entire delivery pipeline on a laptop.

Measure hook duration and remove low-value checks. Developer experience is part of correctness because a policy that is routinely bypassed is weaker than a smaller policy people trust.

## Failure Messages Are Part of the Interface

A hook that exits with status 1 and prints "validation failed" is not finished.

The output should identify:

- the file or component that failed
- the violated rule
- the command needed to reproduce the result
- whether the hook modified files
- where to find the policy or exception process

Mechanical fixes should be automated when they are safe. Judgment calls should remain visible to the developer.

This distinction matters in company-specific hooks. A formatter can rewrite a file. A policy check that forbids an infrastructure setting should explain the risk and point to the approved alternative. Silent organizational knowledge encoded as a regular expression creates resentment and support work.

## pre-commit Is Not a Security Boundary

Client-side hooks are under the developer's control. They can be skipped with `--no-verify`, disabled, or absent entirely. The `SKIP` environment variable can intentionally bypass selected hooks.

That is a feature, not a vulnerability in the model. Exceptional work may require an escape hatch, and broken hooks must not make a repository impossible to repair.

The consequence is that required policy must also run in a trusted environment:

- CI executes the configuration
- branch protection requires the CI result
- server-side scanning handles secrets and vulnerabilities
- deployment policy is enforced at the appropriate control plane
- audit and access controls do not depend on a laptop hook

`pre-commit` improves prevention and feedback. CI and platform controls provide enforcement.

There is also a supply-chain dimension. Hook repositories contain executable code. Teams should use trusted sources, pin revisions, review updates, and understand whether a hook downloads additional dependencies. Convenience does not remove the need for dependency governance.

## Why I Recommend It So Strongly

`pre-commit` works because it occupies a useful middle layer.

It is more consistent than asking developers to remember commands. It is faster than waiting for CI. It is more transparent than hiding checks inside an editor configuration. It is more portable than a collection of hand-written Git hooks copied between repositories.

Most importantly, it gives local development and CI a shared vocabulary:

```shell
pre-commit run --all-files
```

That command can validate a laptop, a pull request, a release branch, or a repository after a hook update. The configuration beside the code explains exactly what it means.

I recommend starting with a small baseline, running it in CI from the first day, and adding repository-specific checks only when they are fast and valuable. Centralize shared company hooks when ownership and reuse justify it. Keep versions pinned, updates deliberate, and failure messages actionable.

The objective is not to prevent every bad commit locally. It is to remove predictable mechanical failures before they consume remote compute, reviewer attention, and developer time.

That is a modest promise, but `pre-commit` delivers it extremely well. It is why the tool is part of my daily workflow and why I recommend it to almost every engineering team.
