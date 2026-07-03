---
title: Why I Switched from cd to zoxide
layout: post
tags: [Tutorials]
---

`cd` is one of the simplest and most reliable Unix commands. It does exactly what it should, is available everywhere, and requires no explanation. Replacing it is therefore not about fixing a broken tool.

The limitation appears in the way we use it. Developers repeatedly navigate to the same repositories, configuration directories, infrastructure projects, and temporary workspaces. Typing complete paths, stepping through several directory levels, or searching shell history adds a small amount of friction each time. None of these actions is difficult, but their cost accumulates.

[zoxide](https://github.com/ajeetdsouza/zoxide) removes much of that repetition. It learns which directories I use and lets me jump to them with a short, memorable query. After integrating it into my shell, directory navigation became faster without requiring a new workflow or a complex configuration.

<!-- more -->

## What zoxide Changes

Traditional `cd` expects a path:

```shell
cd ~/code/platform/terraform/environments/production
```

Shell completion can reduce the typing, but I still need to navigate from a known location and provide enough of the path for the shell to resolve it.

zoxide maintains a small database of directories I have visited. It ranks them using a combination of frequency and recency—often called *frecency*. When I provide one or more search terms, it selects the highest-ranked matching directory.

After visiting the production infrastructure directory a few times, I can use:

```shell
z production
```

If that term is ambiguous, I can add more context:

```shell
z terraform production
```

The search terms do not need to form a complete path. They only need to identify the directory well enough within my own navigation history. This is the practical improvement: I navigate by intent rather than by filesystem structure.

zoxide also preserves the familiar behavior expected from a directory-changing command:

```shell
z ..
z -
z ~/code
```

The first moves to the parent directory, the second returns to the previous directory, and the third uses an explicit path. These operations are not unique advantages over `cd`; their value is that zoxide supports them alongside ranked directory matching.

## Installation and Shell Integration

zoxide is available through common package managers. For example:

```shell
# macOS
brew install zoxide

# Arch Linux
sudo pacman -S zoxide

# Fedora
sudo dnf install zoxide
```

The [official installation instructions](https://github.com/ajeetdsouza/zoxide#installation) cover additional operating systems and package managers.

Installing the binary is only the first step. zoxide must also initialize itself in the shell so that it can update its database when the working directory changes.

For Fish, I add the following line to `~/.config/fish/config.fish`:

```fish
zoxide init fish | source
```

Equivalent initialization is available for Bash and Zsh:

```shell
# Bash: add to ~/.bashrc
eval "$(zoxide init bash)"

# Zsh: add to ~/.zshrc
eval "$(zoxide init zsh)"
```

No additional Fish plugin is required for the normal integration.

## Replacing `cd` or Keeping Both

By default, zoxide provides `z` for direct matching and `zi` for interactive selection. Keeping those commands separate from `cd` has an advantage: shell scripts, muscle memory, and conventional directory navigation remain unchanged, while smarter navigation is available when useful.

This is the configuration I would recommend when first evaluating the tool.

I eventually chose to use zoxide as my interactive `cd` command. zoxide supports this directly through the `--cmd` option. For Fish, the configuration is:

```fish
zoxide init fish --cmd cd | source
```

With that configuration, commands such as `cd nvim` use zoxide's matching logic, while ordinary paths continue to work as expected. The interactive selector becomes available as `cdi`.

Replacing a fundamental shell command should be a deliberate choice. It can be confusing when working on an unfamiliar machine, pair-programming, or explaining commands to someone whose shell has a standard configuration. Keeping `z` and `cd` separate avoids that ambiguity at the cost of learning one additional command.

There is no significant productivity prize for replacing `cd` everywhere. The benefit comes from using ranked navigation for frequently visited directories.

## Interactive Selection for Ambiguous Matches

Some short queries will reasonably match more than one directory. Rather than adding terms until the result becomes unique, `zi` opens an interactive selector:

```shell
zi config
```

This integration uses [fzf](https://github.com/junegunn/fzf), which is optional. It is particularly useful when several repositories contain directories named `config`, `deploy`, or `production`.

The non-interactive `z` command remains preferable when the intended result is predictable. Interactive selection is a fallback for ambiguity, not a required step in every navigation.

## What zoxide Does Not Solve

zoxide optimizes repeated navigation. It is less useful for directories I have never visited, paths that change constantly, or automation that must behave identically across machines.

Shell scripts should continue to use explicit paths and standard `cd` behavior. A personal ranking database is inherently local and contextual; depending on it in automation would make the script unpredictable.

The ranking also needs a short learning period. Immediately after installation, zoxide has little history and cannot infer my common destinations. Its value increases naturally as I continue using the shell.

Finally, zoxide does not replace understanding the filesystem. I still need to know where projects and configuration live, especially when debugging, working on remote hosts, or communicating paths to other engineers. It reduces repetitive typing; it does not turn directory structure into an irrelevant detail.

## A Small Tool with a Narrow, Useful Purpose

I switched from `cd` to zoxide in my interactive shell because it improves a task I perform constantly while staying close to familiar command-line behavior. The tool has one narrow responsibility: remember where I work and help me return there quickly.

That narrowness is why it has remained useful. zoxide does not try to redesign the shell or hide the filesystem. It removes repeated path entry and lets me navigate using the parts of a directory name I actually remember.

For anyone who moves between the same set of repositories and configuration directories every day, it is a practical improvement worth evaluating. I would start with the default `z` command, let the ranking database learn normal usage, and only replace `cd` after the behavior feels predictable.
