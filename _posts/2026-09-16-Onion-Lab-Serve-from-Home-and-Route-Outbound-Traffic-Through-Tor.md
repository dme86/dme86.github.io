---
title: "Onion Lab: Serve from Home and Route Outbound Traffic Through Tor"
description: "A small Docker Compose demo that exposes web and SSH Onion Services without port forwarding or a registered domain, and routes application egress through Tor."
layout: post
date: 2026-09-16 15:00:00 +0200
tags: [Tor, Docker, Networking, Homelab, Linux]
excerpt_separator: "<!--more-->"
---

I think Tor is incredibly cool for a very practical reason: I can make a web service available from a machine at home without configuring port forwarding on my router and without registering a domain anywhere.

Run the service locally, let Tor create an Onion Service, and share the `.onion` address. Someone using Tor Browser can reach it even though I have not exposed an HTTP port to the internet. That is a fascinating capability to fit into such a small setup.

I built [Onion Lab](https://github.com/dme86/Onion-Lab) to make that idea easy to try with Docker Compose. It publishes a small website and an SSH service through Tor, with no web or SSH ports published on the Docker host.

Then I wanted to push the demo further. What if the applications also had to send their outgoing traffic back through the Tor network, even when they knew nothing about proxies?

That became the second half of the lab: Onion Services for incoming connections, transparent Tor routing for outgoing application TCP connections, and everything defined in a small Compose stack.

<!--more-->

## A Service at Home Without Router Configuration

The usual home-hosting workflow starts with questions about public IP addresses, NAT, router rules, dynamic DNS, and domain registration.

An Onion Service changes that workflow. The service establishes outgoing connections to Tor, and clients reach it through the Tor network. It does not require an incoming port on the home router. Its `.onion` address comes from its cryptographic identity rather than a domain registrar. The [Tor Project's explanation of Onion Services](https://community.torproject.org/onion-services/overview/) describes how those connections meet through a rendezvous point.

The requirement is that the host can reach Tor. Visitors also need a Tor-capable client; the address is not an ordinary website that any browser can resolve.

For a demo, that is exactly what I want. I can run a service behind my home router and make it reachable through Tor without first building a conventional public ingress setup.

## Four Containers, One Small Compose Stack

The [Compose configuration](https://github.com/dme86/Onion-Lab/blob/main/compose.yaml) has four services:

- `tor-server` provides the Onion Services and transparent outbound proxy.
- `web` serves static HTML with Python's HTTP server.
- `ssh` provides a demo account with SSH public-key authentication.
- `tor-client` provides a separate Tor client for testing from the host.

The important Compose setting is shared by the web and SSH containers:

```yaml
network_mode: "service:tor-server"
```

They share the network namespace of `tor-server`. They have their own container filesystems and processes, but no independent Docker network interface. Their loopback interface and network rules belong to that shared namespace.

The web server listens on `127.0.0.1:8080`; SSH listens on `127.0.0.1:2222`. Tor maps the Onion Services to those local listeners:

```text
Web Onion Service :80  -> 127.0.0.1:8080
SSH Onion Service :22  -> 127.0.0.1:2222
```

Neither application publishes a host port. The only published port in the stack is the test client's SOCKS proxy:

```yaml
ports:
  - "127.0.0.1:19050:9050"
```

That binding is restricted to host loopback. It gives the helper scripts a local way into Tor without exposing the proxy to the LAN.

I like how little machinery this requires. As I wrote in [I Run Kubernetes at Work. I Still Use Docker Compose at Home.](/2026/08/30/I-Run-Kubernetes-at-Work-I-Still-Use-Docker-Compose-at-Home/), Compose is a good fit when a few containers on one host solve the actual problem.

## Push the Demo Further: Outgoing Traffic Through Tor

Publishing the website as an Onion Service solves the incoming connection path. It does not automatically route a request made by the application through Tor.

If an application fetches an external API directly, that API can see the connection's public source IP. I wanted the demo to cover that direction too: route all supported outbound application traffic through Tor and block traffic that cannot use that path.

An `ALL_PROXY` environment variable would be easy to add, but it depends on the application honoring it. I wanted to demonstrate routing an ordinary TCP connection without proxy support in the application.

The [server entrypoint](https://github.com/dme86/Onion-Lab/blob/main/tor-server/entrypoint.sh) installs `iptables` rules in the shared network namespace. Tor exposes two local endpoints:

```text
TransPort 127.0.0.1:9040
DNSPort   127.0.0.1:5353
```

The rules redirect non-Tor TCP connections to `TransPort` and DNS requests to `DNSPort`. Local service connections stay local. Tor's own user is exempt because Tor must connect to relays directly; redirecting those connections back into Tor would create a loop.

DNS redirection comes before the loopback exemption. That ordering matters because Docker commonly provides a DNS stub at `127.0.0.11`. Exempting every loopback destination first would let those DNS requests miss the intended redirection.

The resulting application path is:

```text
Python HTTPS request in web container
  -> shared network namespace
  -> iptables TCP redirect
  -> Tor TransPort
  -> Tor network
  -> exit relay
  -> external HTTPS API
```

This is different from visiting the lab's Onion Service: a request to an ordinary internet API leaves Tor through an exit relay. The Onion Service connection stays within Tor. This lab does not operate an exit relay itself.

Tor does not carry arbitrary IP traffic. Other UDP traffic is blocked rather than magically transported through Tor, and the entrypoint also attempts to block non-Tor external IPv6 traffic. The intention is that an unsupported application connection fails instead of taking a direct route.

That gives the demo a much more interesting networking property than simply teaching each application a SOCKS address.

## Try It Locally

You need Docker with the Compose plugin, OpenSSH client utilities, and a compatible `nc` implementation with SOCKS5 support for the SSH helper.

```shell
git clone https://github.com/dme86/Onion-Lab.git
cd Onion-Lab
./setup.sh
```

The setup script generates a local Ed25519 client key, builds and starts the stack, and prints the two Onion addresses. Tor may still need time to finish bootstrapping before a connection succeeds.

To print the addresses again:

```shell
./addresses.sh
```

Copy the web address into Tor Browser, or use the included test client:

```shell
./curl-onion.sh
```

The helper's route is deliberately explicit:

```text
curl on host
  -> local SOCKS proxy on 127.0.0.1:19050
  -> tor-client
  -> Tor network
  -> web Onion Service
  -> tor-server
  -> local web server
```

SSH works through the other Onion address:

```shell
./ssh-onion.sh
```

It uses ordinary OpenSSH with a SOCKS5 `ProxyCommand` and the generated key to log in as `demo`. Password authentication and root login are disabled. Knowing the Onion address does not replace SSH authentication.

## Observe the Outbound Path

Run the supplied egress helper:

```shell
./test-egress.sh
```

Its first check makes an ordinary Python HTTPS request from the web container to an external IP-reporting API. There is no SOCKS configuration in that Python request. The reported address should belong to a Tor exit rather than the Docker host's public connection.

The second check sends a UDP packet and waits for a response. A timeout is consistent with the intended blocking, but a remote server might also ignore that packet. I treat it as a demonstration, not proof that every possible escape path is closed. Inspecting firewall rules and packet captures would be the next step for stronger verification.

## Keep the Onion Identity

The Onion identities live in the named volume `onion-lab-tor-server-state`. Keeping that volume keeps the addresses stable across normal container recreations.

Stop the lab with:

```shell
docker compose down
```

Adding `-v` removes the named volumes, including the Onion identities and SSH host key. A subsequent start creates new identities.

The repository includes a helper to back up the Onion identity:

```shell
./backup-onion-identity.sh
```

Those private keys control the identity behind the addresses, so the backup needs to be kept secret.

## A Small Demo with a Clear Boundary

The outbound rules apply to the applications at runtime in the shared network namespace. Docker image pulls and image builds happen through the Docker daemon and are outside that scope. This stack does not route the whole host through Tor.

It is also an educational demo rather than a hardened anonymity appliance. The server needs `NET_ADMIN` to install the rules, the containers share the host kernel, and startup ordering, privileges, and firewall failures would need closer attention for a stronger isolation design.

What I wanted was a small, understandable experiment: serve a website from home without port forwarding or domain registration, add SSH through its own Onion address, and then push the idea further by routing outgoing application connections through Tor too.

[Onion Lab](https://github.com/dme86/Onion-Lab) puts that experiment into a Compose stack you can start, inspect, and take apart. That combination of unusual networking capabilities and very little setup is what makes Tor so cool to me.
