---
title: "Onion Lab: Von zu Hause hosten und ausgehenden Traffic durch Tor leiten"
description: "Eine kleine Docker-Compose-Demo, die Web- und SSH-Onion-Services ohne Portforwarding oder registrierte Domain bereitstellt und ausgehenden Anwendungstraffic durch Tor leitet."
date: 2026-09-16 15:00:00 +0200
tags: [Tor, Docker, Networking, Homelab, Linux]
translation_key: onion-lab
permalink: /de/2026/09/16/Onion-Lab-Serve-from-Home-and-Route-Outbound-Traffic-Through-Tor/
---

Ich finde Tor aus einem sehr praktischen Grund unglaublich cool: Ich kann einen Webservice auf einem Rechner zu Hause verfügbar machen, ohne Portforwarding auf meinem Router einzurichten und ohne irgendwo eine Domain zu registrieren.

Den Service lokal starten, Tor einen Onion Service erstellen lassen und die `.onion`-Adresse teilen. Wer Tor Browser verwendet, kann ihn erreichen, obwohl ich keinen HTTP-Port ins Internet geöffnet habe. Dass sich diese Möglichkeit mit so einem kleinen Setup umsetzen lässt, finde ich faszinierend.

Ich habe [Onion Lab](https://github.com/dme86/Onion-Lab) gebaut, damit sich diese Idee mit Docker Compose leicht ausprobieren lässt. Die Demo stellt eine kleine Website und einen SSH-Service über Tor bereit, ohne Web- oder SSH-Ports auf dem Docker-Host zu veröffentlichen.

Dann wollte ich die Demo weiter auf die Spitze treiben. Was wäre, wenn die Anwendungen auch ihren ausgehenden Traffic wieder durch das Tor-Netzwerk schicken müssten, selbst wenn sie nichts von Proxys wissen?

Daraus entstand die zweite Hälfte des Labs: Onion Services für eingehende Verbindungen, transparentes Tor-Routing für ausgehende TCP-Verbindungen der Anwendungen und alles in einem kleinen Compose-Stack definiert.

<!--more-->

## Ein Service zu Hause ohne Routerkonfiguration

Beim üblichen Hosting zu Hause geht es zunächst um öffentliche IP-Adressen, NAT, Routerregeln, dynamisches DNS und die Registrierung einer Domain.

Ein Onion Service verändert diesen Ablauf. Der Service baut ausgehende Verbindungen zu Tor auf, und Clients erreichen ihn über das Tor-Netzwerk. Dafür ist kein eingehender Port auf dem Heimrouter nötig. Seine `.onion`-Adresse ergibt sich aus seiner kryptografischen Identität statt aus einer Registrierung bei einem Domainanbieter. Die [Erklärung zu Onion Services des Tor-Projekts](https://community.torproject.org/onion-services/overview/) beschreibt, wie diese Verbindungen an einem Rendezvous-Punkt zusammenkommen.

Voraussetzung ist, dass der Host Tor erreichen kann. Auch Besucher brauchen einen Tor-fähigen Client; die Adresse gehört nicht zu einer gewöhnlichen Website, die jeder Browser auflösen kann.

Für eine Demo ist das genau das, was ich möchte. Ich kann einen Service hinter meinem Heimrouter betreiben und über Tor erreichbar machen, ohne vorher einen konventionellen öffentlichen Ingress aufzubauen.

## Vier Container, ein kleiner Compose-Stack

Die [Compose-Konfiguration](https://github.com/dme86/Onion-Lab/blob/main/compose.yaml) enthält vier Services:

- `tor-server` stellt die Onion Services und den transparenten Proxy für ausgehende Verbindungen bereit.
- `web` liefert statisches HTML mit dem HTTP-Server von Python aus.
- `ssh` stellt einen Demo-Account mit SSH-Public-Key-Authentifizierung bereit.
- `tor-client` stellt einen separaten Tor-Client für Tests vom Host aus bereit.

Die entscheidende Compose-Einstellung verwenden sowohl der Web- als auch der SSH-Container:

```yaml
network_mode: "service:tor-server"
```

Sie teilen den Netzwerk-Namespace von `tor-server`. Sie haben eigene Container-Dateisysteme und Prozesse, aber keine unabhängige Docker-Netzwerkschnittstelle. Ihre Loopback-Schnittstelle und Netzwerkregeln gehören zu diesem gemeinsamen Namespace.

Der Webserver lauscht auf `127.0.0.1:8080`; SSH lauscht auf `127.0.0.1:2222`. Tor ordnet die Onion Services diesen lokalen Listenern zu:

```text
Web Onion Service :80  -> 127.0.0.1:8080
SSH Onion Service :22  -> 127.0.0.1:2222
```

Keine der Anwendungen veröffentlicht einen Host-Port. Der einzige veröffentlichte Port im Stack gehört zum SOCKS-Proxy des Testclients:

```yaml
ports:
  - "127.0.0.1:19050:9050"
```

Diese Bindung ist auf die Loopback-Schnittstelle des Hosts beschränkt. Sie gibt den Hilfsskripten einen lokalen Zugang zu Tor, ohne den Proxy im LAN erreichbar zu machen.

Mir gefällt, wie wenig Infrastruktur das erfordert. Wie ich in [I Run Kubernetes at Work. I Still Use Docker Compose at Home.](/2026/08/30/I-Run-Kubernetes-at-Work-I-Still-Use-Docker-Compose-at-Home/) geschrieben habe, passt Compose gut, wenn ein paar Container auf einem Host das eigentliche Problem lösen.

## Die Demo auf die Spitze treiben: ausgehender Traffic durch Tor

Die Website als Onion Service bereitzustellen löst den Pfad für eingehende Verbindungen. Eine Anfrage, die die Anwendung selbst stellt, wird dadurch nicht automatisch durch Tor geleitet.

Wenn eine Anwendung eine externe API direkt abfragt, kann diese API die öffentliche Quell-IP der Verbindung sehen. Ich wollte mit der Demo auch diese Richtung abdecken: sämtlichen unterstützten ausgehenden Anwendungstraffic durch Tor leiten und Traffic blockieren, der diesen Pfad nicht nutzen kann.

Eine Umgebungsvariable `ALL_PROXY` wäre leicht hinzuzufügen, setzt aber voraus, dass die Anwendung sie berücksichtigt. Ich wollte das Routing einer gewöhnlichen TCP-Verbindung demonstrieren, ohne dass die Anwendung Proxy-Unterstützung benötigt.

Der [Entrypoint des Servers](https://github.com/dme86/Onion-Lab/blob/main/tor-server/entrypoint.sh) installiert `iptables`-Regeln im gemeinsamen Netzwerk-Namespace. Tor stellt zwei lokale Endpunkte bereit:

```text
TransPort 127.0.0.1:9040
DNSPort   127.0.0.1:5353
```

Die Regeln leiten TCP-Verbindungen von Prozessen außerhalb von Tor an `TransPort` und DNS-Anfragen an `DNSPort` um. Lokale Service-Verbindungen bleiben lokal. Tors eigener Benutzer ist ausgenommen, weil Tor direkt Verbindungen zu Relays aufbauen muss; diese Verbindungen wieder in Tor umzuleiten würde eine Schleife erzeugen.

Die DNS-Umleitung steht vor der Loopback-Ausnahme. Diese Reihenfolge ist wichtig, weil Docker häufig einen DNS-Stub unter `127.0.0.11` bereitstellt. Würde man zuerst jedes Loopback-Ziel ausnehmen, würden diese DNS-Anfragen die vorgesehene Umleitung umgehen.

Der resultierende Anwendungspfad sieht so aus:

```text
Python HTTPS request in web container
  -> shared network namespace
  -> iptables TCP redirect
  -> Tor TransPort
  -> Tor network
  -> exit relay
  -> external HTTPS API
```

Das unterscheidet sich vom Besuch des Onion Service des Labs: Eine Anfrage an eine gewöhnliche Internet-API verlässt Tor über ein Exit-Relay. Die Verbindung zum Onion Service bleibt innerhalb von Tor. Dieses Lab betreibt selbst kein Exit-Relay.

Tor transportiert keinen beliebigen IP-Traffic. Anderer UDP-Traffic wird blockiert, statt auf magische Weise durch Tor transportiert zu werden, und der Entrypoint versucht außerdem, externen IPv6-Traffic von Prozessen außerhalb von Tor zu blockieren. Die Absicht ist, dass eine nicht unterstützte Anwendungsverbindung fehlschlägt, statt einen direkten Weg zu nehmen.

Damit zeigt die Demo eine deutlich interessantere Netzwerkeigenschaft, als jeder Anwendung einfach eine SOCKS-Adresse beizubringen.

## Lokal ausprobieren

Du brauchst Docker mit dem Compose-Plugin, OpenSSH-Client-Werkzeuge und für das SSH-Hilfsskript eine kompatible `nc`-Implementierung mit SOCKS5-Unterstützung.

```shell
git clone https://github.com/dme86/Onion-Lab.git
cd Onion-Lab
./setup.sh
```

Das Setup-Skript erzeugt einen lokalen Ed25519-Client-Schlüssel, baut und startet den Stack und gibt die beiden Onion-Adressen aus. Tor braucht möglicherweise noch Zeit, um das Bootstrapping abzuschließen, bevor eine Verbindung gelingt.

Um die Adressen erneut auszugeben:

```shell
./addresses.sh
```

Kopiere die Webadresse in Tor Browser oder verwende den enthaltenen Testclient:

```shell
./curl-onion.sh
```

Der Weg des Hilfsskripts ist bewusst explizit:

```text
curl on host
  -> local SOCKS proxy on 127.0.0.1:19050
  -> tor-client
  -> Tor network
  -> web Onion Service
  -> tor-server
  -> local web server
```

SSH funktioniert über die andere Onion-Adresse:

```shell
./ssh-onion.sh
```

Das Skript verwendet gewöhnliches OpenSSH mit einem SOCKS5-`ProxyCommand` und dem erzeugten Schlüssel, um sich als `demo` anzumelden. Passwortauthentifizierung und Root-Login sind deaktiviert. Die Onion-Adresse zu kennen ersetzt keine SSH-Authentifizierung.

## Den ausgehenden Pfad beobachten

Führe das mitgelieferte Egress-Hilfsskript aus:

```shell
./test-egress.sh
```

Sein erster Check stellt eine gewöhnliche Python-HTTPS-Anfrage aus dem Webcontainer an eine externe API, die die sichtbare IP-Adresse zurückgibt. Diese Python-Anfrage enthält keine SOCKS-Konfiguration. Die gemeldete Adresse sollte zu einem Tor-Exit gehören und nicht zum öffentlichen Internetzugang des Docker-Hosts.

Der zweite Check sendet ein UDP-Paket und wartet auf eine Antwort. Ein Timeout passt zur beabsichtigten Blockierung, aber ein entfernter Server könnte dieses Paket ebenfalls ignorieren. Ich betrachte das als Demonstration und nicht als Beweis dafür, dass jeder mögliche Ausweg geschlossen ist. Firewallregeln und Paketmitschnitte zu prüfen wäre der nächste Schritt für eine belastbarere Verifikation.

## Die Onion-Identität behalten

Die Onion-Identitäten liegen im benannten Volume `onion-lab-tor-server-state`. Solange dieses Volume erhalten bleibt, bleiben die Adressen bei normalen Container-Neuerstellungen stabil.

Stoppe das Lab mit:

```shell
docker compose down
```

Mit zusätzlichem `-v` werden die benannten Volumes entfernt, einschließlich der Onion-Identitäten und des SSH-Hostschlüssels. Ein anschließender Start erzeugt neue Identitäten.

Das Repository enthält ein Hilfsskript, um die Onion-Identität zu sichern:

```shell
./backup-onion-identity.sh
```

Diese privaten Schlüssel kontrollieren die Identität hinter den Adressen, daher muss das Backup geheim bleiben.

## Eine kleine Demo mit einer klaren Grenze

Die Regeln für ausgehenden Traffic gelten zur Laufzeit für die Anwendungen im gemeinsamen Netzwerk-Namespace. Docker-Image-Pulls und Image-Builds laufen über den Docker-Daemon und liegen außerhalb dieses Geltungsbereichs. Dieser Stack leitet nicht den gesamten Host durch Tor.

Es ist außerdem eine Demo zum Lernen und keine gehärtete Anonymitäts-Appliance. Der Server braucht `NET_ADMIN`, um die Regeln zu installieren, die Container teilen den Kernel des Hosts, und für ein stärkeres Isolationskonzept müssten Startreihenfolge, Privilegien und Firewallfehler genauer betrachtet werden.

Ich wollte ein kleines, verständliches Experiment: eine Website von zu Hause ohne Portforwarding oder Domainregistrierung bereitstellen, SSH über eine eigene Onion-Adresse hinzufügen und die Idee dann weiter auf die Spitze treiben, indem auch ausgehende Anwendungsverbindungen durch Tor geleitet werden.

[Onion Lab](https://github.com/dme86/Onion-Lab) verpackt dieses Experiment in einen Compose-Stack, den du starten, untersuchen und auseinandernehmen kannst. Diese Kombination aus ungewöhnlichen Netzwerkmöglichkeiten und sehr wenig Einrichtungsaufwand macht Tor für mich so cool.
