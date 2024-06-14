---
title: Why i switched from cd to zoxide
layout: post
tags: [Tutorials]
---

This is a rather short article, but it highlights a small change with a big impact. I will briefly discuss why I switched from 'cd' to 'zoxide' and why you might want to consider it as well.

<!-- more -->

'cd' is a command you probably use every day hundreds of times. Maybe you also have some sort of autocompletion for your shell because it's faster and more convenient.

Well, I installed zoxide, along with a [plugin for the fish shell](https://github.com/kidonng/zoxide.fish), and after setting the alias "**alias cd=z**", I basically replaced every "**cd**" with "**z**".

This enables me, for example, to type "**cd -**" and navigate to the previous directory every time.
Also, after a while, zoxide will learn your frequently used paths, so you don't have to type "**cd ~/.config/nvim**" anymore — a simple "**cd nvim**" is enough, and the same goes for your project folders.

So just check out [zoxide on GitHub](https://github.com/ajeetdsouza/zoxide) to learn how to install and configure your shell with this great tool, improving your speed and convenience even further.
