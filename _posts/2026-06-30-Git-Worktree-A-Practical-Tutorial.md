---
title: "Git Worktree: A Practical Tutorial"
description: "Use Git worktrees to develop features, review branches, test hotfixes, and update long-running work without stashing or juggling checkouts."
layout: post
date: 2026-06-30 10:00:00 +0200
tags: [Git, Development, Productivity]
excerpt_separator: "<!-- more -->"
---

You are halfway through a feature when another branch suddenly needs your attention. Perhaps a pull request needs reviewing, a hotfix needs testing, `main` has moved, or you need to compare your work with the latest upstream code.

In a single working directory, that interruption usually starts with cleanup. You stash unfinished changes, switch branches, wait for dependencies or generated files to change, do the urgent work, switch back, restore the stash, and try to remember where you were. If the changes are awkward to stash, you might create a temporary commit instead. If this happens often enough, you might clone the repository several times and accept the extra disk usage and maintenance.

None of those approaches is impossible, but all of them add friction. The real cost is context switching: your editor, build artifacts, running services, and mental model all belonged to one task, and switching the folder underneath them disrupts that context.

Git worktrees solve this cleanly. Instead of switching branches inside one folder, you switch folders.

<!-- more -->

## What Is a Git Worktree?

A Git worktree is an additional working directory attached to an existing repository. The worktrees share Git's repository data, including objects and references, while each directory has its own checked-out files, index, and `HEAD`.

That means several branches can be available at the same time:

```text
~/code/my-project/
├── main/
├── feature-login/
├── hotfix-build/
└── review-123/
```

The `main` directory is a normal clone. The other directories are linked worktrees. You can open each one in a separate editor window, run tests independently, and leave unfinished changes exactly where they are.

This is the core idea: one repository, multiple working directories, no routine branch juggling.

## Start with a Normal Clone

Create a project directory and clone the repository into a `main` subdirectory:

```shell
mkdir -p ~/code/my-project
git clone git@github.com:USER/REPO.git ~/code/my-project/main
cd ~/code/my-project/main
```

This clone is the anchor for the setup. Keep it checked out on `main` and use it to create and manage sibling worktrees.

A successful clone already downloads the remote references available at that moment, so an extra `git fetch` immediately afterward is usually unnecessary. Fetch later when you need newer remote state.

## Create a Feature Worktree

From the `main` directory, create a new local branch based on `origin/main` and check it out in a sibling directory:

```shell
git worktree add ../feature-login -b feature/login origin/main
```

This command does three things:

1. Creates the local branch `feature/login`.
2. Starts it at `origin/main`.
3. Creates the `../feature-login` working directory and checks out the branch there.

The directory and branch do not need identical names. Using `feature-login` for the folder avoids a nested directory, while `feature/login` keeps the branch in your preferred namespace.

Git normally prevents the same branch from being checked out in multiple worktrees at once. That safeguard helps prevent two directories from silently making conflicting changes to the same branch.

## Work Normally Inside the Feature Directory

Move into the new worktree and develop as usual:

```shell
cd ../feature-login
git status
git add .
git commit -m "Add login feature"
git push -u origin feature/login
```

Committing and pushing work exactly as they do in a normal clone. A linked worktree is not a restricted or disposable Git environment. It is a regular working directory connected to the shared repository.

You can now leave this folder dirty, keep a development server running in it, or leave its editor window open while working elsewhere.

## List Your Worktrees

To see every worktree attached to the repository, run:

```shell
git worktree list
```

Typical output looks like this:

```text
/home/user/code/my-project/main          abc1234 [main]
/home/user/code/my-project/feature-login def5678 [feature/login]
```

The output shows each path, its current commit, and the checked-out branch. Run it before cleanup when you are unsure which branches are still in use.

## Review an Existing Remote Branch

Suppose you need to inspect a colleague's branch without disturbing your feature work. Return to the main worktree, update the remote references, and add a review worktree:

```shell
cd ~/code/my-project/main
git fetch origin
git worktree add ../review-123 origin/feature/some-branch
```

Because `origin/feature/some-branch` is a remote-tracking reference rather than a new local branch, this worktree uses a detached `HEAD`. That is fine for reading code, comparing behavior, running tests, or inspecting a particular commit or tag.

Detached worktrees are not ideal for normal feature development. Commits made there do not belong to a branch unless you create one. If the review turns into development work, create and switch to a local branch first:

```shell
git switch -c review/fix-123
```

The distinction is simple: detached worktrees are useful for inspection; named local branches are better for work you intend to keep and push.

## Bring Upstream Changes into a Feature

Pulling updates in the `main` worktree does not automatically update feature branches. Each branch has its own history, regardless of which worktree displays it.

To incorporate recent changes from `origin/main`, choose either rebase or merge according to how the branch is used.

### Rebase a Personal Branch

For a branch that only you use, rebasing keeps the history linear:

```shell
cd ~/code/my-project/feature-login
git fetch origin
git rebase origin/main
make test
git push --force-with-lease
```

Rebase replays the feature commits on top of the current `origin/main`, which changes their commit IDs. The remote branch therefore needs a force push. Use `--force-with-lease`, not plain `--force`: it refuses to overwrite remote work that you have not fetched.

### Merge into a Shared Branch

For a branch used by several developers, merging avoids rewriting commits that other people may already have:

```shell
cd ~/code/my-project/feature-login
git fetch origin
git merge origin/main
make test
git push
```

The tradeoff is straightforward. Rebase produces a cleaner linear history but rewrites commit history. Merge preserves shared history but may add a merge commit. Prefer rebase for private branches and merge for shared branches unless your team has an explicit convention that says otherwise.

In both cases, fetch first, resolve any conflicts in the feature worktree, and run the relevant test suite before pushing.

## Clean Up After the Feature Is Merged

Once the feature is merged and you no longer need its working directory, remove the worktree and then delete the local branch:

```shell
cd ~/code/my-project/main
git worktree remove ../feature-login
git branch -d feature/login
```

`git worktree remove` refuses to remove a worktree with uncommitted changes unless forced. Treat that refusal as a useful safety check rather than an obstacle.

Use `git worktree prune` only when a worktree directory was deleted manually and Git still has stale metadata for it:

```shell
git worktree prune
```

Pruning is not the normal way to remove an active worktree. Prefer `git worktree remove`, which cleans up both the directory and Git's metadata deliberately.

## Common Mistakes

### Using Detached Worktrees for Feature Development

A detached worktree is convenient for inspecting a pull request, commit, or tag. For normal development, create a named branch so commits have an obvious home and can be pushed without recovery work.

### Editing `.git` Files Manually

Linked worktrees use `.git` files and internal metadata to point back to the shared repository. Do not edit those files manually. Use `git worktree add`, `git worktree remove`, and `git worktree repair` when the layout needs management.

### Starting with a Bare Repository Without a Reason

Some worktree guides recommend a bare repository as the central store. That can be useful for specialized setups, but it adds concepts and configuration that most developers do not need. One normal clone named `main` is easier to understand, works with familiar Git commands, and is sufficient for this workflow.

### Assuming `main` Updates Every Feature

Running `git pull` in `~/code/my-project/main` updates only the branch checked out there. Feature branches do not inherit those commits automatically. Fetch and then rebase or merge `origin/main` inside each feature worktree when you want to update it.

## A Practical Default

Keep one normal clone as `main`. Create sibling worktrees for active features, urgent hotfixes, and temporary reviews. Remove them when the work is finished.

This layout is simple enough to remember, uses standard Git behavior, and keeps each task in its own directory. More importantly, it removes the routine need for stashing, branch juggling, temporary commits, and duplicate full clones.

When another branch suddenly needs attention, leave your current work exactly where it is and switch folders.
