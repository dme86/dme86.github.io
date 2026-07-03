---
title: "Why Git Worktrees Are Awesome for Parallel Development"
description: "Git worktrees keep features, reviews, hotfixes, and parallel tools in separate directories without duplicating the repository or constantly switching branches."
layout: post
date: 2026-07-03 19:35:00 +0200
tags: [Git, Development, Productivity, Developer Experience]
excerpt_separator: "<!--more-->"
---

Git branches isolate history, but a normal clone gives us only one working directory.

That mismatch creates friction as soon as more than one task matters. I may have an unfinished feature in my editor when a production hotfix arrives. I may want to run a pull request beside `main`, compare two implementations, or let separate automation processes work on independent branches. With one directory, every interruption begins by changing the state underneath my tools.

The usual responses are stashing, temporary commits, repeated branch switching, or cloning the repository again. They work, but they make context switching more expensive than it needs to be.

Git worktrees are one of my favorite Git features because they solve the problem at the correct level. Instead of repeatedly changing which branch one directory represents, I give each active branch its own directory.

<!--more-->

## A Branch Should Be a Place I Can Enter

The normal Git workflow encourages us to think of a branch as repository state:

```shell
git switch feature/search
```

The current directory is rewritten to represent that branch. Tracked files change, the index changes, build output may become stale, editor language servers re-index the project, and a running development process may now observe files from a different task.

The branch has changed, but the rest of my development environment may not have caught up.

A worktree turns the branch into a stable place:

```text
~/code/example/
├── main/
├── feature-search/
├── hotfix-auth/
└── review-217/
```

Each directory can stay open in its own editor window. Each can have independent uncommitted changes, dependencies, build artifacts, environment files, and terminal sessions. Switching tasks becomes an ordinary directory change.

That feels like a small distinction until interruptions become normal. Then it changes the development model.

## What a Worktree Actually Is

A Git repository has one main worktree created by `git clone` or `git init`. `git worktree add` attaches additional working directories to the same repository.

The worktrees share repository data such as objects and most references. Each worktree has its own:

- checked-out files
- index
- `HEAD`
- current branch or detached state
- uncommitted changes

This sharing is why worktrees are more efficient than unrelated clones. Git does not need to maintain a complete independent object database for every directory.

They are still real working directories. If every worktree runs `npm install`, creates a Python virtual environment, or builds a large artifact, those files consume disk space separately. Worktrees avoid duplicate Git history; they do not make every project file free.

## Why They Are Better Than Constant Branch Switching

### Unfinished Work Can Remain Unfinished

I do not need to stash a half-complete change merely because another branch needs attention.

The feature directory can remain dirty. Its editor, tests, logs, and development server can remain exactly where I left them. I move to the hotfix directory, finish the urgent task, and return without reconstructing the feature state from a stash description.

Stashes are useful for short-lived storage. They are a poor default workspace manager.

### Reviews Become Isolated Environments

A code review is more reliable when I can build and run the branch, not only read its diff.

A review worktree can have its own dependencies and generated files without disturbing my feature. I can compare the review against `main` in two editor windows or run both versions at the same time on different ports.

When the review is complete, I remove the directory.

### Hotfixes Start from Clean State

Urgent fixes are exactly when I do not want unrelated local state.

A hotfix worktree based on the current remote default branch provides a clean starting point while preserving ongoing work elsewhere. The branch origin is explicit, and the fix cannot accidentally include files staged for another task.

### Build State Stays with the Branch

Branch switching changes tracked files but does not reliably clean every generated artifact, dependency tree, cache, or local database.

Separate worktrees reduce cross-branch contamination. They do not guarantee perfect isolation—external services and shared caches still exist—but the filesystem state owned by each task stays in its directory.

### Parallel Work Becomes Practical

Worktrees are particularly useful when several independent processes need repository access.

I can run a test matrix against different branches, reproduce a CI failure while continuing feature work, or give separate coding agents their own worktrees. Each process gets an independent index and working directory instead of racing over the same checkout.

This is a strong safety boundary for filesystem changes, but not a complete sandbox. Worktrees still share Git references, and processes can still conflict over ports, databases, containers, credentials, or external environments. Parallel workflows should assign those resources deliberately.

## A Complete Example

Start with a normal clone kept on `main`:

```shell
mkdir -p ~/code/example
git clone git@github.com:company/example.git ~/code/example/main
cd ~/code/example/main
```

Fetch the current remote state and create a feature branch in a sibling worktree:

```shell
git fetch origin
git worktree add ../feature-search \
  -b feature/search \
  origin/main
```

This command:

1. creates the local branch `feature/search`
2. starts it at `origin/main`
3. creates `../feature-search`
4. checks the new branch out there

Enter the feature worktree and use it like a normal repository:

```shell
cd ../feature-search
make install
make test

git add .
git commit -m "Add search endpoint"
git push -u origin feature/search
```

Now suppose an urgent authentication fix appears before the feature is finished. Leave the feature directory untouched and create another worktree from the main checkout:

```shell
cd ../main
git fetch origin
git worktree add ../hotfix-auth \
  -b hotfix/auth-timeout \
  origin/main
```

Work on the hotfix independently:

```shell
cd ../hotfix-auth
make install
make test

git add .
git commit -m "Handle authentication timeout"
git push -u origin hotfix/auth-timeout
```

List all attached worktrees from any of them:

```shell
git worktree list
```

The output resembles:

```text
/home/me/code/example/main            a1b2c3d [main]
/home/me/code/example/feature-search  d4e5f6a [feature/search]
/home/me/code/example/hotfix-auth     1a2b3c4 [hotfix/auth-timeout]
```

After the hotfix is merged, remove its worktree from another directory:

```shell
cd ../main
git worktree remove ../hotfix-auth
git branch -d hotfix/auth-timeout
```

The feature directory is still present with exactly the state it had before the interruption:

```shell
cd ../feature-search
git status
```

That is the entire value proposition in one workflow: urgent work happened without stashing, rewriting the feature directory, or maintaining another full clone.

## My Preferred Directory Layout

I keep one ordinary clone as a stable `main` worktree and create siblings for active tasks:

```text
~/code/example/
├── main/
├── feature-search/
└── hotfix-auth/
```

The branch name can contain slashes while the directory name stays flat:

```shell
git worktree add ../feature-search -b feature/search origin/main
```

This layout has several advantages:

- paths remain predictable
- the main checkout is easy to find
- editors show meaningful directory names
- worktrees can be removed without touching the anchor clone
- shell navigation tools can distinguish tasks easily

I prefer a normal clone over a bare-repository layout for most teams. Bare setups can be elegant, but they add concepts that are unnecessary for the common workflow. A normal `main` directory remains familiar to every Git user.

## Worktrees Improve Tool Isolation

Each worktree can contain its own ignored local configuration:

```text
.env
.venv/
node_modules/
.build/
```

That means a feature can use a temporary environment variable or dependency state without changing another active branch directory.

This is also useful for long-running processes. The `main` worktree can serve the stable application on one port while a feature worktree runs the changed version on another:

```shell
# main
make serve PORT=8080

# feature-search
make serve PORT=8081
```

The ports must be different because worktrees isolate files, not network resources. The same applies to container names, local database schemas, message-broker subjects, and cloud environments.

A good repository makes these values configurable so parallel worktrees do not require editing committed files.

## Worktrees and Coding Agents

Parallel coding tools make worktrees even more relevant.

Two agents writing into the same checkout can overwrite files, race over the index, or commit each other's changes. Assigning one branch and one worktree to each agent gives their filesystem operations an explicit boundary:

```shell
git worktree add ../agent-api -b agent/api origin/main
git worktree add ../agent-tests -b agent/tests origin/main
```

The branches can later be reviewed and integrated through normal Git workflows.

This does not remove the need to coordinate scope. Agents can still make conflicting semantic changes, and both may modify the same shared external resource. Worktrees prevent accidental checkout-level interference; they do not solve architecture or merge conflicts.

The model is still valuable because every participant has an inspectable directory and branch. Ownership is clearer than when multiple processes mutate one working tree.

## Important Constraints

### One Branch Is Normally Checked Out Once

Git normally refuses to check out the same branch in two worktrees simultaneously.

That safeguard prevents two directories from independently changing one branch's index and `HEAD`. Create a separate branch for each active worktree instead of forcing past the protection.

### Use `git worktree remove`

Do not treat a linked worktree as an ordinary directory to delete manually.

Remove it with:

```shell
git worktree remove ../feature-search
```

Git refuses to remove a dirty worktree unless forced. That is a useful check against losing uncommitted work.

If a directory was deleted outside Git and stale metadata remains, clean it with:

```shell
git worktree prune
```

Pruning is recovery for missing directories, not the normal removal workflow.

### Shared Repository Data Is Still Shared

Branches, tags, and objects are largely shared. Fetching in one worktree updates remote-tracking references visible from the others. Deleting or renaming a branch affects the shared repository.

Each worktree has separate checked-out state, not a private copy of Git history.

### Dependencies Still Consume Space

Several worktrees with large `node_modules` directories or build trees can consume more space than the shared Git objects save.

That cost is often justified by isolation, but inactive worktrees should be removed. `git worktree list` makes accumulated work visible.

## Worktrees Do Not Replace Good Branch Discipline

A worktree is a place for a branch, not an alternative to branch ownership and cleanup.

Branches still need clear purposes. Long-running work still needs updates from the default branch. Reviews still need tests. Merged worktrees and local branches should be removed. A directory-per-task can become clutter just as easily as a branch list can.

I keep only worktrees that represent active contexts. If a task is finished or paused indefinitely, I commit or preserve the necessary state and remove the working directory.

The goal is not to maximize the number of simultaneous branches. It is to make legitimate parallel work cheap and safe.

## Switching Folders Is Better Than Rebuilding Context

Git worktrees are awesome because they align the filesystem with the way engineering work actually happens.

Features are interrupted. Hotfixes arrive. Reviews need local execution. CI failures need reproduction. Tools and agents increasingly work in parallel. One mutable directory is an unnecessary bottleneck for all of those contexts.

With worktrees, each task gets a stable place. The Git history remains shared, while working files, indexes, dependencies, and editor state remain separate.

The essential commands are small:

```shell
git worktree add ../feature -b feature/name origin/main
git worktree list
git worktree remove ../feature
```

For a command-by-command guide covering review worktrees, rebasing, merging, and cleanup, see [Git Worktree: A Practical Tutorial](/2026/06/30/Git-Worktree-A-Practical-Tutorial/).

The conceptual shift is even simpler:

> Stop switching branches for every task. Switch directories instead.

Once parallel work becomes normal, it is difficult to return to one checkout.
