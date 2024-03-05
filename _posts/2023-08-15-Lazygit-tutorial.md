---
tile: Lazygit tutorial
layout: post
---

This is my [Lazygit](https://github.com/jesseduffield/lazygit) tutorial, which will help you get an overview of the most important features. It will *speed up your git workflow* and make it **easier** for you.

<!-- more -->

![lazygit](https://i.imgur.com/6dig3uj.png)

> If you're a coder/hacker, I would recommend using neovim - but at least learn some basic vim commands. They will follow you throughout your career AND they're great!

> You can  use hotkeys to switch through panels, those are num `1`  to `5`.

## Your first steps

Open Lazygit inside a git repository, press `Tab` to move forward and `Shift + Tab` to move backwards between **panels** on the left side.
Use `j` and `k` to move up/down *inside* a panel and `J`, `K` to scroll up/down inside your *main* panel on the right side.

Add a few files to your repository; Lazygit will reload automatically, or if you're pressing `r`.

Now choose those files from the *files* panel to be staged by selecting them (Navigate to the Files panel via `Tab` or `Shift + Tab` (*Or Hotkey `1`*), select a file using `j` or `k`) and press `Space` to toggle the selected file *staged/unstaged*.

Just press `c` to commit your staged files and [write your commit message](https://www.conventionalcommits.org/).

And push your code by pressing `P`.

> You can use `a` to stage/unstage **all** files - be careful with this because Lazygit will not remember your selected files via `Space`.

You're able to stage individual hunks/lines from a file by selecting the file and pressing `Enter`.
This will split your main panel into "*Unstaged/Staged*" view.
Again, you're able to use vim commands `j` and `k` to move through your hunks/lines, select them by pressing `Space`, press `Tab` to toggle between "*Unstaged/Staged*" view.
If you want to go back to your files panel, just press `ESC`.

> You're able to scroll via `J`, `K`.

To create a [Tag](https://git-scm.com/book/en/v2/Git-Basics-Tagging) just press `T` on your *commits* panel (*Hotkey 4*).

With staged changes in your files panel, you can amend it to *any* commit you selected it with `A`. Amending commits earlier than the latest commit will result in Lazygit doing a rebase for you.

You can edit the commit message with `r`, or with your external editor using `R`.

To select one or multiple commits for cherry picking, type `C`. You can then switch to another branch and apply them with `v`.

Another fantastic feature is the capability to expand all side panels into half-screen mode and subsequently into full-screen mode using the **+** button.

Example:

|Half Screen  |Full Screen  |
|--|--|
|![enter image description here](https://i.imgur.com/3ImZ5f3.png)  |![enter image description here](https://i.imgur.com/07XO8Pm.png)  |


## Commits Panel

### Squash & Fixup

To squash commits, just navigate (`Tab`) to your commits panel, select the specific commit and press `s`.
A Popup Menu will ask you

> Are you sure you want to squash this commit into the commit below?

Just press `Enter` and both commits are now squashed.
You're able to undo by simple type `Ctrl + z` and `Enter`.

### Open commit in Browser

A highly useful and convenient feature is the ability to directly open the selected commit in your browser by simply pressing `o`.


## Branches Panel

Navigate to your Branches Menu and type `n` to create a new branch. To rename it, press `R` while the branch is selected.

To explore the commits of a branch without switching to it, use `Enter`. You can drill down into individual commits with `Enter` again, or move back up with `ESC`.
