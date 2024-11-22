---
title: Routing All macOS Traffic Through the Tor Network
layout: post
tags: [Tutorial]
---

For certain tasks, I need to use macOS and sometimes prefer to route all my traffic through the [Tor network](https://www.torproject.org/). In this tutorial, I will guide you through the process.

While you can download and use the Tor Browser for enhanced anonymity, I find that simply routing traffic through Tor's network suffices for my needs while maintaining a civilized workflow.

<!-- more -->

## Installation

First, install Tor using Homebrew and start the Tor service:

```shell
brew install tor
brew services start tor
```

## Configure Network Settings

Next, configure your network settings to use Tor as a SOCKS proxy:

1.  Open **System Preferences**.
2.  Navigate to **Network**.
3.  Select your active network connection and click **Advanced**.
4.  Go to the **Proxies** tab.
5.  Check **SOCKS Proxy** and enter `localhost` as the server and `9050` as the port.

## Verify Tor Connection

To ensure that your traffic is being routed through the Tor network, visit [Check Tor Project](https://check.torproject.org/).
You are able to use Onion-Links like: [https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/](https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/)

## Managing the Tor Service

To restart Tor, use the following command:
```shell
brew services restart tor
```

To stop Tor, use:
```shell
brew services stop tor
```

**Note:** After stopping Tor, remember to disable the SOCKS Proxy in your Network Settings to resume browsing without Tor.

