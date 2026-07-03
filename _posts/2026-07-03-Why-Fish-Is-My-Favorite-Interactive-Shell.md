---
title: "Why Fish Is My Favorite Interactive Shell"
description: "Fish is designed for human interaction first: useful defaults, strong completions, directory history, and a clear escape hatch when POSIX shell syntax is required."
layout: post
date: 2026-07-03 14:00:00 +0200
tags: [Linux, Fish, Shell, CLI, Productivity]
excerpt_separator: "<!--more-->"
---

The shell is one of my most frequently used interfaces. It sits between me and source code, Git, Kubernetes, package managers, remote systems, build tools, and almost every operational task I perform. Small usability improvements in that interface compound over thousands of commands.

That is why [Fish](https://fishshell.com/) is my favorite interactive shell.

Fish does not try to be a drop-in implementation of the POSIX shell language. It makes a different and, for interactive work, more useful promise: it is designed to be convenient, discoverable, responsive, and pleasant for a human sitting at a terminal. Syntax highlighting, history-based autosuggestions, descriptive completions, sensible defaults, and built-in navigation features are part of the normal experience rather than a framework I first have to assemble.

The lack of strict POSIX syntax is a real trade-off, but a much smaller one than it is often made out to be. Most commands are external programs and work exactly as expected. When I genuinely need POSIX shell parsing, I can invoke the appropriate interpreter explicitly with `sh -c 'command'` or run a script through its declared shebang.

<!--more-->

## An Interactive Shell and a Scripting Language Are Different Jobs

Discussions about shells often combine two separate requirements.

The first is interactive use. Here, the shell is a user interface. It should help me construct commands, detect mistakes, find previous work, understand available options, and move through the filesystem with as little friction as possible.

The second is script portability. Here, the shell is an interpreter for a language with a defined compatibility target. Predictability across machines matters more than interactive convenience.

There is no requirement that one program must be the best choice for both jobs.

I use Fish as my interactive shell because it was designed around interaction. I still write portable shell scripts with an appropriate shebang:

```sh
#!/bin/sh

set -eu

printf '%s\n' "This script is interpreted by a POSIX shell."
```

For scripts that deliberately depend on Bash features, I declare Bash instead:

```bash
#!/usr/bin/env bash
```

The interpreter belongs in the script's contract. My login shell does not need to silently determine what language a script uses, and a script should not assume that the person running it uses Bash interactively.

This separation removes much of the supposed conflict around Fish. POSIX compatibility is important where portability is the requirement. It is not automatically the highest priority for a human-facing command interface.

## Fish Is Designed for Human Interaction

Fish calls itself the friendly interactive shell, and that description is architectural rather than cosmetic.

Its defaults assume that the person at the keyboard should receive useful feedback immediately. After installing Fish, I get:

- syntax highlighting while constructing a command
- autosuggestions based on command history
- tab completion with descriptions
- completions for many command-specific arguments
- searchable history
- sane handling of multiline commands
- built-in help and discoverable functions

Other shells can provide many of these capabilities. The difference is how much configuration, plugin management, and accumulated shell knowledge is required before they become the normal experience.

Fish is willing to choose clearer syntax and stronger defaults even when that means diverging from historical shell conventions. Variables are set with `set`. Conditionals end with `end`. Command substitutions use parentheses. Lists are first-class values instead of strings waiting to be split accidentally. These choices make Fish code visibly different from POSIX shell code, but they also make interactive functions easier to read.

For example:

```fish
set project ~/code/example

if test -d $project
    cd $project
end
```

The objective is not novelty. It is reducing ambiguity for the person writing and reading the command.

I also value Fish's tendency to show what it knows. Typing part of a previous command produces a muted suggestion that I can accept with the right-arrow key. Pressing Tab does not merely dump possible strings; completions can explain whether an entry is a directory, Git branch, command option, or another semantic value.

That feedback reduces the need to remember exact syntax without hiding the command that will run. I still see and control the final command line before executing it.

## POSIX Incompatibility Is Usually a Syntax Boundary

Fish runs ordinary executables in the same way as other shells:

```fish
git status
kubectl get pods
terraform plan
curl https://example.com
```

The compatibility difference appears when the shell itself must parse syntax. Variable assignment, loops, conditionals, command substitution, process substitution, and some redirection forms differ between Fish and POSIX shells.

A snippet copied from documentation may therefore fail if it contains shell syntax such as:

```sh
for file in *.log; do
    printf '%s\n' "$file"
done
```

That does not require changing my login shell. I can explicitly ask a POSIX shell to parse the snippet:

```fish
sh -c 'for file in *.log; do printf "%s\n" "$file"; done'
```

The important detail is that the entire shell expression belongs inside the quoted argument. `sh -c` starts a separate shell process and asks it to interpret that string. Pipelines, redirections, loops, and variable expansion intended for the POSIX shell must therefore be inside the quotes.

This is useful for an occasional command from installation instructions or documentation:

```fish
sh -c 'command_a | command_b > result.txt'
```

If the snippet depends specifically on Bash rather than POSIX `sh`, I use Bash explicitly:

```fish
bash -c 'some_bash_specific_command'
```

For a longer operation, creating a real script is safer and easier to review than growing an increasingly complicated `sh -c` string.

There are also two security rules worth preserving:

- Do not construct a `sh -c` string by concatenating untrusted input.
- Do not confuse shell compatibility with command compatibility.

The first avoids command injection. The second prevents unnecessary workarounds: if a command is an ordinary executable and does not depend on shell-specific parsing, it normally needs no wrapper at all.

Using `sh -c` is not an admission that Fish failed. It is an explicit interpreter boundary. We routinely choose Python, Ruby, Go, or a task runner for code suited to those tools. Choosing a POSIX shell for a POSIX snippet follows the same principle.

## Directory History Makes Navigation Feel Natural

Fish automatically keeps a history of recently visited directories. That enables browser-like backward and forward navigation without manually maintaining a directory stack.

The commands are:

```fish
prevd
nextd
```

By default, Fish binds them to:

- `Alt` + `Left Arrow` for the previous directory
- `Alt` + `Right Arrow` for the next directory

Suppose I move through several locations:

```fish
cd ~/code/platform
cd ~/.config/fish
cd /tmp
```

Pressing `Alt` + `Left Arrow` takes me back to `~/.config/fish`, and pressing it again returns to `~/code/platform`. `Alt` + `Right Arrow` moves forward through the same history.

This is more capable than repeatedly toggling between two paths with `cd -`. Fish supports `cd -` as well, but `prevd` and `nextd` preserve a navigable sequence. The `dirh` command prints that history, while `cdh` opens an interactive selection of recently visited directories.

Some terminal emulators or desktop environments intercept Alt-arrow combinations. When that happens, the `prevd` and `nextd` commands still work, and Fish key bindings can be adjusted explicitly.

Directory history complements tools such as [zoxide](/2024/06/14/Why-I-switched-from-cd-to-zoxide/). I use zoxide when I know where I want to go and can identify the destination by a few memorable characters. I use Fish's previous and next directory navigation when I want to retrace the path I just took.

Those are different navigation problems, and the combination handles both well.

## Installing Fisher

Both Tide and `fzf.fish` are distributed as Fish plugins. I manage them with [Fisher](https://github.com/jorgebucaran/fisher), a small plugin manager implemented entirely in Fish.

Run the official bootstrap command from an interactive Fish session:

```fish
curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher
```

The first command downloads the Fisher function and loads it into the current shell. The second installs Fisher into the Fish configuration so it remains available in future sessions.

As with every `curl | shell` installation command, this executes remote code. In a managed or security-sensitive environment, inspect the source, pin an approved revision, or distribute Fisher through the organization's trusted workstation bootstrap instead of executing the upstream branch directly.

Fisher records installed plugins in:

```text
~/.config/fish/fish_plugins
```

I keep that file in my dotfiles. On another machine, running `fisher update` reconciles the installed plugins with the declared list. This turns the shell setup into reproducible configuration rather than a collection of forgotten manual installations.

## `fzf.fish` Makes Command History Genuinely Searchable

Fish's built-in history and autosuggestions are already strong, but one plugin substantially improves how I retrieve commands from a large history: [`fzf.fish`](https://github.com/PatrickF1/fzf.fish).

I recommend this plugin extremely highly.

Its history search is bound to `Ctrl` + `R`. Instead of stepping backward through commands one at a time, it opens an interactive fuzzy-search interface over Fish's command history. I can type fragments from anywhere in a command, narrow the candidates immediately, inspect the complete syntax-highlighted command, and insert the selected result back into the editable command line.

For example, I may remember that a command involved `kubectl`, a particular namespace, and `jsonpath`, but not the exact order or quoting. Pressing `Ctrl` + `R` and entering a few of those fragments is usually enough to recover the complete command.

If text is already present at the cursor when I start the search, `fzf.fish` uses it to seed the query. This makes the transition from remembering part of a command to finding the exact previous invocation almost frictionless.

The selected command is inserted rather than executed immediately. I can inspect it, change the namespace, replace a filename, or verify the active Kubernetes context before pressing Enter. That behavior preserves the main advantage of interactive history: reuse without surrendering control.

With Fisher installed, the plugin can be added with:

```fish
fisher install PatrickF1/fzf.fish
```

The [`fzf`](https://github.com/junegunn/fzf) binary is required. The plugin also supports fuzzy searches for files, Git commits, Git status entries, processes, and Fish variables. Its directory search can optionally use `fd` and `bat` for faster discovery and richer previews.

Those additional searches are useful, but history search is the reason I consider `fzf.fish` essential. Long command lines often encode hard-won operational knowledge: the correct flags for a diagnostic command, a complex API request, a package-manager query, or a safe sequence used during an incident. Fuzzy history search turns that accumulated work into a practical personal knowledge base.

History still needs judgment. An old command may contain an outdated path, environment, image tag, cluster context, or destructive flag. `fzf.fish` makes commands easier to retrieve; it does not make them safe to replay blindly.

## Tide Turns the Prompt into Operational Context

A prompt should provide enough context to prevent mistakes without becoming a dashboard that delays every command.

For Fish, I recommend [Tide](https://github.com/IlanCosman/tide). It is implemented in Fish, renders information asynchronously, and includes an interactive configuration wizard:

```fish
tide configure
```

Tide can be added through Fisher with:

```fish
fisher install IlanCosman/tide@v6
```

Tide supports prompt items for Git state, command duration, background jobs, Kubernetes, cloud providers, and many development tools. Items can be enabled, removed, and arranged on either side of the prompt. A Nerd Font is recommended when using configurations that rely on additional glyphs.

The value is not decoration. It is context at the moment I need it.

### Git and Project State

Inside a Git repository, Tide can show the current branch and working-tree state, including modified, staged, untracked, or conflicting files. That reduces the chance of running a release or deployment command from the wrong branch or overlooking local changes.

### Tool Versions

Tide has items for tools and runtimes such as Node.js, Python, Go, Rust, Ruby, Java, and others. These items are context-sensitive. For example, the Node item is relevant when the current directory is inside a project containing `package.json`; it then displays the active Node version.

This is particularly useful with version managers. When moving between repositories, the prompt gives immediate feedback that the expected runtime or toolchain is active. It does not replace a lockfile, tool-version file, or reproducible build, but it catches configuration mistakes early.

### Kubernetes Context and Namespace

Tide's `kubectl` item displays the current Kubernetes context and, when relevant, namespace. For anyone working with several clusters, this is operationally important information.

A prompt showing `development` instead of `production` is not a security control, and I still verify the target before a destructive command:

```fish
kubectl config current-context
kubectl config view --minify
```

The prompt is a continuous warning surface. It makes the active environment difficult to forget while switching repositories, terminals, VPNs, and incident contexts.

This balance is what I want from a prompt: show high-value state, compute expensive sections asynchronously, and let me remove everything that does not help me make a decision.

## `lsd` Makes Routine File Inspection Easier

Another tool I pair with Fish is [`lsd`](https://github.com/lsd-rs/lsd), a modern implementation of `ls` with colors, icons, tree views, and more readable formatting.

It is available from common package managers:

```shell
# macOS
brew install lsd

# Arch Linux
sudo pacman -S lsd

# Fedora
sudo dnf install lsd
```

Icons require a compatible terminal font, but `lsd` remains useful without turning file listings into a visual spectacle. The long format is easier to scan, file types are easier to distinguish, and the built-in tree view is useful for quickly understanding an unfamiliar repository.

I configure a small set of aliases for interactive use:

```fish
if status --is-interactive
    if type --query lsd
        alias ls='lsd'
        alias ll='lsd --long'
        alias la='lsd --long --all'
        alias lt='lsd --tree --depth 2'
    end
end
```

This belongs in `~/.config/fish/config.fish` or a dedicated file under `~/.config/fish/conf.d/`.

The `type --query` guard keeps the shell usable on systems where `lsd` is not installed. Restricting the aliases to interactive sessions prevents personal presentation preferences from unexpectedly affecting non-interactive Fish processes.

Fish implements aliases as functions. If I need the original system command while the alias is active, I can bypass functions explicitly:

```fish
command ls
```

Abbreviations are another good option. Unlike a hidden alias, an abbreviation expands directly in the editable command line before execution, so I can see what will run:

```fish
abbr --add ll 'lsd --long'
abbr --add la 'lsd --long --all'
abbr --add lt 'lsd --tree --depth 2'
```

For commands with important or surprising behavior, visible abbreviations are often preferable to aliases. For familiar listing shortcuts, either approach is reasonable as long as the configuration remains small and understandable.

## Convenience Is an Engineering Property

Shell convenience is sometimes dismissed as aesthetic preference. That misses the operational effect of a good interface.

Useful completions reduce syntax errors. Visible Git state reduces branch mistakes. A Kubernetes context in the prompt reduces environment confusion. Directory history removes repeated path reconstruction. Syntax highlighting can reveal an invalid command before it runs. Fast feedback keeps the interface usable instead of teaching people to work around it.

None of these features replaces review, automation, tests, access controls, or reproducible environments. They improve the quality of the human interaction surrounding those systems.

Fish succeeds because it treats that interaction as its primary design problem. It is not trying to preserve every historical shell behavior at the expense of the person at the keyboard. It provides strong defaults and a coherent language, while still running the ordinary Unix tools on which real work depends.

When a POSIX boundary appears, I cross it explicitly:

```fish
sh -c 'command'
```

That small escape hatch is enough for occasional POSIX snippets. Portable scripts retain their own `#!/bin/sh` interpreter, Bash scripts declare Bash, and my interactive shell remains optimized for human use.

Combined with `fzf.fish` for fuzzy history search, Tide for high-value prompt context, `lsd` for clearer file inspection, zoxide for learned directory jumps, and Fish's own forward and backward directory history, the result is a terminal environment that is fast, informative, and deliberately comfortable.

That is why Fish remains my favorite shell.
