---
title: Advanced (CLI) tools for coders & hackers
layout: post
tags: [Tutorials]
---

> This article is aimed at the advanced coder/hacker and exclusively includes tools that go far beyond the standards such as "bash", "nano", or "git".

I am writing this text because I repeatedly see users struggling with outdated tools, even though there have been better alternatives available for years. I can only recommend that you remain open-minded and occasionally question your setup in order to stay up to date.

If you're working a lot with AWS I recommend visiting their [AWS Labs](https://github.com/awslabs) repo!

<!-- more -->

## Terminal emulators

Terminals are indispensable in our everyday lives. As a follower of the [Unix philosophy](https://en.wikipedia.org/wiki/Unix_philosophy), I appreciate minimal programs that can be tailored to personal preferences. On Macs, I use [Alacritty](https://github.com/alacritty/alacritty) (with tabs through [tmux](https://github.com/tmux/tmux) - but it's also possible to use it with [tabbed](https://tools.suckless.org/tabbed/)), and on Linux systems, I use [st](https://github.com/dme86/st) from [suckless](https://suckless.org/).

In general, my need for tabs in a terminal depends on the window manager of the system I am using. If I am using a tiling window manager, I usually don't need tabs.

## shell

I have been using [fish](https://github.com/dme86/fish) as my default shell for some time now. Like many of us, I started with bash, switched to zsh at some point, and now I've ended up with fish.
Fish provides most of the functions that I had to add to zsh, out of the box, and yet it remains quite lightweight.

# CLI
Here are some general CLI tools I'm using in my role as a DevOps engineer. Some of them are extended versions of tools you may already be familiar with.

## zoxide

[zoxide](https://github.com/ajeetdsouza/zoxide) is an advanced version of `cd`. It remembers which directories you use most frequently, so you can "jump" to them in just a few keystrokes and works with all major shells.

## exa

[exa](https://github.com/ogham/exa) is a modern replacement for `ls`.
Giving it more features and better defaults. It uses colours to distinguish file types and metadata. It knows about symlinks, extended attributes, and Git.

## fzf

[fzf](https://github.com/junegunn/fzf) is a command-line [fuzzy](https://en.wikipedia.org/wiki/Fuzzing) finder that completely replaces your `reverse-i-search`.

## fd

[fd](https://github.com/sharkdp/fd) is a replacement for `find`. While it does not aim to support all of `find`'s powerful functionality, it provides sensible (opinionated) defaults for a majority of use cases.

## ripgrep

[ripgrep](https://github.com/BurntSushi/ripgrep) is a line-oriented search tool that recursively searches the current directory for a regex pattern. By default, ripgrep will respect gitignore rules and automatically skip hidden files/directories and binary files.

If you're using [neovim](https://github.com/dme86/neovim), you could use the [telescope plugin](https://github.com/nvim-telescope/telescope.nvim) to employ ripgrep for swift file searches within your editor.

# terminal user interfaces

## k9s

To manage k8s in style, I recommend using [k9s](https://github.com/derailed/k9s). It is an excellent terminal UI tool that utilizes some vim keybindings, thus significantly enhancing your workflow speed!

## lazygit

For me, [lazygit](https://github.com/jesseduffield/lazygit) is an excellent Git tool. It's fast, operates within the terminal, and I can integrate it into my [neovim](https://github.com/dme86/neovim) setup.
It really simplifies and enhances the management of your version control tasks.

# Graphical interfaces

Last but not least, entering the realm of graphical interfaces. Most of the time, I use [tiling window managers](https://en.wikipedia.org/wiki/Tiling_window_manager) because they are more efficient for me and offer the ability to be highly customized.

## dwm

My favorite (dynamic) tiling window manager is [dwm](https://github.com/dme86/dwm). Written in C, its source code is designed to never exceed 2000 [SLOC](https://en.wikipedia.org/wiki/Source_lines_of_code).

It is easy to customize, usable in a multi-monitor setup, fast, small, and remains consistent.

## yabai & sketchybar

On Macs, I would prefer to use [yabai](https://github.com/koekeishiya/yabai), along with [sketchybar](https://github.com/FelixKratz/SketchyBar). Although I haven't designed my environment with these tools yet, I would say that this combination is ideal if you want to work on a Mac while retaining the need for a tiling window manager.
