---
title: k9s Tutorial
layout: page
tags: [Tutorials]
---

I am excited to introduce an article about k9s, a powerful tool designed for efficient management of kubernetes clusters, whether it be on platforms like EKS or k3s. This tool has significantly enhanced my productivity, allowing me to navigate kubernetes environments, manage pods, and swiftly identify issues with remarkable speed.

<!-- more -->

The speed and efficiency derived from not relying on your mouse for interactions with k9s is remarkable. By solely utilizing your keyboard, you develop muscle memory, resulting in a faster workflow compared to other programs.

I have been using k9s for several years, and I firmly believe it is the most efficient solution for managing and maintaining Kubernetes clusters. I trust it so much that I regularly use it for version upgrades, and it has never let me down.

Upon opening k9s for the first time, you should expect to receive an overview like this:
![enter image description here](https://i.imgur.com/x5irRPq.png)


As you might be familiar with from vim commands, navigation in k9s allows you to move up and down using `j` and `k`. Press `Enter` to select your kubernetes context.

Upon doing so, it will display a comprehensive list of all your pods:
![enter image description here](https://i.imgur.com/0mKgBN3.png)


In the top right corner, you'll consistently find a list of available commands, extending beyond the fundamental ones. In the pod-view, for instance, you can open a shell with `s`, view the pod logs using `l`, or edit the YAML file associated with the pod through `e`.

Here's a glimpse into the log-view of my demo-pod:
![enter image description here](https://i.imgur.com/rucaWyP.png)

You might have observed that the menu in the top right has been altered; it now provides options for toggling features such as Autoscroll, FullScreen, etc. while inside the log-view:
![enter image description here](https://i.imgur.com/Jicq8Tu.png)


No matter where you are in the menu, you can always return to the previous screen by pressing `ESC`.

I recommend getting acquainted with the search command, which follows the same pattern as vim: `/`. Pressing `/` will bring up a search box, facilitating quick searches for namespaces, pods, and more.

Switching between Kubernetes services is straightforward. First, obtain an overview by pressing `Ctrl+a`:
![enter image description here](https://i.imgur.com/86BXNra.png)


As demonstrated, I entered `/` in the aliases overview and typed `con`, displaying all search results for `con` in all aliases.

After a few hours, you'll likely identify the most essential services, enabling you to switch between them rapidly. Simply press the vim-command `:` and enter the name or shortcut you wish to switch to, like `pod` (shortcut `po`) or `namespace` (shortcut `ns`).

Remember, you can always look up all aliases via `Ctrl+a`, and if ever in doubt, press `?` to access the general help page.

With this knowledge, while entering command mode and typing a resource name or alias, navigating through frequently used resources could become cumbersome.
Allow me to introduce: HotKeys!

You can customize your own HotKeys on a global scale:

    $XDG_CONFIG_HOME/k9s/hotkeys.yaml

You have the flexibility to define HotKeys on both a global **and** context-specific or cluster-specific level:

    $XDG_DATA_HOME/k9s/clusters/clusterX/contextY/hotkeys.yaml

Your HotKeys will also be visible on the help page `?`.

Example hotkeys.yaml:

```yaml
hotKeys:
  # Hitting Shift-0 navigates to your pod view
  shift-0:
    shortCut:    Shift-0
    description: Viewing pods
    command:     pods
  # Hitting Shift-1 navigates to your deployments
  shift-1:
    shortCut:    Shift-1
    description: View deployments
    command:     dp
  # Hitting Shift-2 navigates to your xray deployments
  shift-2:
    shortCut:    Shift-2
    description: Xray Deployments
    command:     xray deploy
  # Hitting Ctrl-U view the resources in the namespace of your current selection
  ctrl-u:
    shortCut:    Ctrl-U
    description: Namespaced resources
    command:     "$RESOURCE_NAME $NAMESPACE"
    keepHistory: true # whether you can return to the previous view
```
