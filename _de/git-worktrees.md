---
title: "Git Worktrees geben parallelen Aufgaben eigene Verzeichnisse"
description: "Git Worktrees halten Features, Reviews, Hotfixes und parallele Werkzeuge in getrennten Verzeichnissen, ohne das Repository zu duplizieren oder ständig Branches zu wechseln."
date: 2026-07-03 19:35:00 +0200
tags: [Git, Development, Productivity, Developer Experience]
translation_key: git-worktrees
permalink: /de/2026/07/03/Why-Git-Worktrees-Are-Awesome-for-Parallel-Development/
---

Git-Branches trennen die Versionsgeschichte, aber ein normaler Clone gibt uns nur ein Arbeitsverzeichnis.

Dieses Missverhältnis erzeugt Reibung, sobald mehr als eine Aufgabe wichtig ist. Vielleicht habe ich ein unfertiges Feature im Editor, wenn ein Produktions-Hotfix ansteht. Vielleicht möchte ich einen Pull Request neben `main` ausführen, zwei Implementierungen vergleichen oder separate Automatisierungsprozesse an unabhängigen Branches arbeiten lassen. Mit nur einem Verzeichnis beginnt jede Unterbrechung damit, den Zustand unter meinen Werkzeugen zu verändern.

Die üblichen Antworten sind Stashing, temporäre Commits, wiederholte Branch-Wechsel oder ein weiterer Clone des Repositorys. Das funktioniert, macht Kontextwechsel aber teurer als nötig.

Git Worktrees gehören zu meinen liebsten Git-Funktionen, weil sie das Problem auf der richtigen Ebene lösen. Statt immer wieder zu ändern, welchen Branch ein Verzeichnis repräsentiert, gebe ich jedem aktiven Branch sein eigenes Verzeichnis.

<!--more-->

## Ein Branch sollte ein Ort sein, den ich betreten kann

Der normale Git-Workflow verleitet uns dazu, einen Branch als Repository-Zustand zu betrachten:

```shell
git switch feature/search
```

Das aktuelle Verzeichnis wird umgeschrieben, um diesen Branch abzubilden. Versionierte Dateien ändern sich, der Index ändert sich, Build-Ausgaben können veraltet sein, Language Server im Editor indexieren das Projekt neu, und ein laufender Entwicklungsprozess sieht möglicherweise plötzlich Dateien aus einer anderen Aufgabe.

Der Branch hat sich geändert, aber der Rest meiner Entwicklungsumgebung ist möglicherweise noch nicht nachgezogen.

Ein Worktree macht aus dem Branch einen stabilen Ort:

```text
~/code/example/
├── main/
├── feature-search/
├── hotfix-auth/
└── review-217/
```

Jedes Verzeichnis kann in seinem eigenen Editorfenster geöffnet bleiben. Jedes kann unabhängige, noch nicht committete Änderungen, Abhängigkeiten, Build-Artefakte, Umgebungsdateien und Terminalsitzungen haben. Die Aufgabe zu wechseln wird zu einem gewöhnlichen Verzeichniswechsel.

Das wirkt wie ein kleiner Unterschied, bis Unterbrechungen zum Alltag gehören. Dann verändert es das Entwicklungsmodell.

## Was ein Worktree eigentlich ist

Ein Git-Repository hat einen Haupt-Worktree, der durch `git clone` oder `git init` angelegt wird. `git worktree add` verbindet zusätzliche Arbeitsverzeichnisse mit demselben Repository.

Die Worktrees teilen Repository-Daten wie Objekte und die meisten Referenzen. Jeder Worktree hat seine eigenen:

- ausgecheckten Dateien
- Index
- `HEAD`
- aktuellen Branch oder Detached-Zustand
- noch nicht committeten Änderungen

Durch diese gemeinsame Nutzung sind Worktrees effizienter als voneinander unabhängige Clones. Git muss nicht für jedes Verzeichnis eine vollständig unabhängige Objektdatenbank pflegen.

Es sind trotzdem echte Arbeitsverzeichnisse. Wenn jeder Worktree `npm install` ausführt, eine virtuelle Python-Umgebung anlegt oder ein großes Artefakt baut, belegen diese Dateien jeweils separat Speicherplatz. Worktrees vermeiden eine duplizierte Git-Versionsgeschichte; sie machen nicht jede Projektdatei kostenlos.

## Was sie gegenüber ständigem Branch-Wechsel verbessern

### Unfertige Arbeit darf unfertig bleiben

Ich muss eine halb fertige Änderung nicht stashen, nur weil ein anderer Branch Aufmerksamkeit braucht.

Das Feature-Verzeichnis darf weiterhin uncommittete Änderungen enthalten. Sein Editor, seine Tests, Logs und sein Entwicklungsserver können genau dort bleiben, wo ich sie verlassen habe. Ich wechsle ins Hotfix-Verzeichnis, erledige die dringende Aufgabe und kehre zurück, ohne den Feature-Zustand aus einer Stash-Beschreibung rekonstruieren zu müssen.

Stashes sind nützlich für kurzfristige Ablage. Als Standardverwaltung für Arbeitsumgebungen eignen sie sich schlecht.

### Reviews bekommen isolierte Umgebungen

Ein Code Review ist zuverlässiger, wenn ich den Branch bauen und ausführen kann, statt nur seinen Diff zu lesen.

Ein Review-Worktree kann eigene Abhängigkeiten und generierte Dateien haben, ohne mein Feature zu stören. Ich kann den Review-Branch und `main` in zwei Editorfenstern vergleichen oder beide Versionen gleichzeitig auf unterschiedlichen Ports ausführen.

Wenn das Review abgeschlossen ist, entferne ich das Verzeichnis.

### Hotfixes beginnen mit einem sauberen Zustand

Gerade bei dringenden Korrekturen möchte ich keinen lokalen Zustand aus anderen Aufgaben.

Ein Hotfix-Worktree auf Basis des aktuellen Remote-Default-Branches bietet einen sauberen Ausgangspunkt und bewahrt gleichzeitig die laufende Arbeit an anderer Stelle. Der Ursprung des Branches ist explizit, und der Fix kann nicht versehentlich Dateien enthalten, die für eine andere Aufgabe im Index vorgemerkt wurden.

### Der Build-Zustand bleibt beim Branch

Ein Branch-Wechsel ändert versionierte Dateien, räumt aber nicht zuverlässig jedes generierte Artefakt, jeden Abhängigkeitsbaum, Cache oder jede lokale Datenbank auf.

Getrennte Worktrees reduzieren die Vermischung von Zuständen zwischen Branches. Sie garantieren keine perfekte Isolation – externe Services und gemeinsame Caches existieren weiterhin –, aber der Dateisystemzustand, der zu einer Aufgabe gehört, bleibt in ihrem Verzeichnis.

### Parallele Arbeit wird praktikabel

Worktrees sind besonders nützlich, wenn mehrere unabhängige Prozesse Zugriff auf das Repository brauchen.

Ich kann eine Testmatrix gegen verschiedene Branches ausführen, einen CI-Fehler reproduzieren und gleichzeitig am Feature weiterarbeiten oder separaten Coding-Agenten eigene Worktrees geben. Jeder Prozess bekommt einen unabhängigen Index und ein eigenes Arbeitsverzeichnis, statt mit den anderen um denselben Checkout zu konkurrieren.

Das ist eine starke Sicherheitsgrenze für Dateisystemänderungen, aber keine vollständige Sandbox. Worktrees teilen weiterhin Git-Referenzen, und Prozesse können weiterhin bei Ports, Datenbanken, Containern, Zugangsdaten oder externen Umgebungen miteinander kollidieren. Parallele Workflows sollten diese Ressourcen bewusst zuweisen.

## Ein vollständiges Beispiel

Beginne mit einem normalen Clone, der auf `main` bleibt:

```shell
mkdir -p ~/code/example
git clone git@github.com:company/example.git ~/code/example/main
cd ~/code/example/main
```

Hole den aktuellen Remote-Zustand und erstelle einen Feature-Branch in einem benachbarten Worktree:

```shell
git fetch origin
git worktree add ../feature-search \
  -b feature/search \
  origin/main
```

Dieser Befehl:

1. erstellt den lokalen Branch `feature/search`
2. lässt ihn bei `origin/main` beginnen
3. erstellt `../feature-search`
4. checkt den neuen Branch dort aus

Wechsle in den Feature-Worktree und verwende ihn wie ein normales Repository:

```shell
cd ../feature-search
make install
make test

git add .
git commit -m "Add search endpoint"
git push -u origin feature/search
```

Angenommen, jetzt wird eine dringende Korrektur an der Authentifizierung nötig, bevor das Feature fertig ist. Lass das Feature-Verzeichnis unberührt und erstelle vom Haupt-Checkout aus einen weiteren Worktree:

```shell
cd ../main
git fetch origin
git worktree add ../hotfix-auth \
  -b hotfix/auth-timeout \
  origin/main
```

Arbeite unabhängig am Hotfix:

```shell
cd ../hotfix-auth
make install
make test

git add .
git commit -m "Handle authentication timeout"
git push -u origin hotfix/auth-timeout
```

Liste von einem beliebigen Worktree aus alle verbundenen Worktrees auf:

```shell
git worktree list
```

Die Ausgabe sieht ungefähr so aus:

```text
/home/me/code/example/main            a1b2c3d [main]
/home/me/code/example/feature-search  d4e5f6a [feature/search]
/home/me/code/example/hotfix-auth     1a2b3c4 [hotfix/auth-timeout]
```

Nachdem der Hotfix gemergt wurde, entferne seinen Worktree von einem anderen Verzeichnis aus:

```shell
cd ../main
git worktree remove ../hotfix-auth
git branch -d hotfix/auth-timeout
```

Das Feature-Verzeichnis ist immer noch vorhanden und hat genau den Zustand vor der Unterbrechung:

```shell
cd ../feature-search
git status
```

Das ist der gesamte Nutzen in einem Workflow: Die dringende Arbeit wurde erledigt, ohne zu stashen, das Feature-Verzeichnis umzuschreiben oder einen weiteren vollständigen Clone zu pflegen.

## Meine bevorzugte Verzeichnisstruktur

Ich behalte einen gewöhnlichen Clone als stabilen `main`-Worktree und erstelle benachbarte Verzeichnisse für aktive Aufgaben:

```text
~/code/example/
├── main/
├── feature-search/
└── hotfix-auth/
```

Der Branch-Name kann Schrägstriche enthalten, während der Verzeichnisname flach bleibt:

```shell
git worktree add ../feature-search -b feature/search origin/main
```

Diese Struktur hat mehrere Vorteile:

- Pfade bleiben vorhersehbar
- der Haupt-Checkout ist leicht zu finden
- Editoren zeigen aussagekräftige Verzeichnisnamen
- Worktrees lassen sich entfernen, ohne den als Anker dienenden Clone anzufassen
- Werkzeuge zur Shell-Navigation können Aufgaben leicht unterscheiden

Für die meisten Teams bevorzuge ich einen normalen Clone gegenüber einer Struktur mit einem Bare-Repository. Bare-Setups können elegant sein, fügen aber Konzepte hinzu, die für den üblichen Workflow unnötig sind. Ein normales `main`-Verzeichnis bleibt jedem Git-Nutzer vertraut.

## Worktrees verbessern die Isolation der Werkzeuge

Jeder Worktree kann seine eigene ignorierte lokale Konfiguration enthalten:

```text
.env
.venv/
node_modules/
.build/
```

Damit kann ein Feature eine temporäre Umgebungsvariable oder einen eigenen Abhängigkeitszustand verwenden, ohne das Verzeichnis eines anderen aktiven Branches zu verändern.

Das ist auch für lange laufende Prozesse nützlich. Der `main`-Worktree kann die stabile Anwendung auf einem Port bereitstellen, während ein Feature-Worktree die geänderte Version auf einem anderen ausführt:

```shell
# main
make serve PORT=8080

# feature-search
make serve PORT=8081
```

Die Ports müssen unterschiedlich sein, weil Worktrees Dateien isolieren und keine Netzwerkressourcen. Dasselbe gilt für Containernamen, lokale Datenbankschemas, Message-Broker-Subjects und Cloud-Umgebungen.

Ein gutes Repository macht diese Werte konfigurierbar, damit parallele Worktrees keine Änderungen an committeten Dateien erfordern.

## Worktrees und Coding-Agenten

Parallele Coding-Werkzeuge machen Worktrees noch relevanter.

Zwei Agenten, die in denselben Checkout schreiben, können Dateien überschreiben, beim Zugriff auf den Index kollidieren oder die Änderungen des jeweils anderen committen. Jedem Agenten einen Branch und einen Worktree zuzuweisen gibt ihren Dateisystemoperationen eine explizite Grenze:

```shell
git worktree add ../agent-api -b agent/api origin/main
git worktree add ../agent-tests -b agent/tests origin/main
```

Die Branches können später über normale Git-Workflows geprüft und integriert werden.

Das macht eine Abstimmung des Arbeitsumfangs nicht überflüssig. Agenten können weiterhin inhaltlich widersprüchliche Änderungen vornehmen, und beide können dieselbe gemeinsam genutzte externe Ressource verändern. Worktrees verhindern versehentliche gegenseitige Eingriffe auf Checkout-Ebene; sie lösen keine Architektur- oder Merge-Konflikte.

Das Modell ist trotzdem wertvoll, weil jeder Beteiligte ein überprüfbares Verzeichnis und einen Branch hat. Die Zuständigkeit ist klarer, als wenn mehrere Prozesse einen einzigen Working Tree verändern.

## Wichtige Einschränkungen

### Ein Branch ist normalerweise nur einmal ausgecheckt

Git weigert sich normalerweise, denselben Branch gleichzeitig in zwei Worktrees auszuchecken.

Diese Schutzmaßnahme verhindert, dass zwei Verzeichnisse unabhängig voneinander den Index und `HEAD` eines Branches verändern. Erstelle für jeden aktiven Worktree einen separaten Branch, statt diesen Schutz zu umgehen.

### Verwende `git worktree remove`

Behandle einen verknüpften Worktree nicht wie ein gewöhnliches Verzeichnis, das du manuell löschst.

Entferne ihn mit:

```shell
git worktree remove ../feature-search
```

Git weigert sich, einen Worktree mit uncommitteten Änderungen zu entfernen, sofern das nicht erzwungen wird. Das ist eine nützliche Prüfung, um noch nicht committete Arbeit nicht zu verlieren.

Wenn ein Verzeichnis außerhalb von Git gelöscht wurde und veraltete Metadaten zurückbleiben, bereinige sie mit:

```shell
git worktree prune
```

Pruning dient der Bereinigung nach verschwundenen Verzeichnissen und ist nicht der normale Ablauf zum Entfernen eines Worktrees.

### Gemeinsame Repository-Daten bleiben gemeinsam

Branches, Tags und Objekte werden größtenteils gemeinsam genutzt. Ein Fetch in einem Worktree aktualisiert Remote-Tracking-Referenzen, die auch in den anderen sichtbar sind. Einen Branch zu löschen oder umzubenennen betrifft das gemeinsame Repository.

Jeder Worktree hat einen separaten ausgecheckten Zustand und keine private Kopie der Git-Versionsgeschichte.

### Abhängigkeiten brauchen weiterhin Speicherplatz

Mehrere Worktrees mit großen `node_modules`-Verzeichnissen oder Build-Verzeichnisbäumen können mehr Speicherplatz verbrauchen, als die gemeinsam genutzten Git-Objekte einsparen.

Dieser Aufwand ist durch die Isolation oft gerechtfertigt, aber inaktive Worktrees sollten entfernt werden. `git worktree list` macht angesammelte Arbeit sichtbar.

## Worktrees ersetzen keine gute Branch-Disziplin

Ein Worktree ist ein Ort für einen Branch und keine Alternative zu klaren Zuständigkeiten und dem Aufräumen von Branches.

Branches brauchen weiterhin einen klaren Zweck. Lange laufende Arbeit braucht weiterhin Aktualisierungen aus dem Default-Branch. Reviews brauchen weiterhin Tests. Worktrees und lokale Branches nach einem Merge sollten entfernt werden. Ein Verzeichnis pro Aufgabe kann genauso leicht unübersichtlich werden wie eine Branch-Liste.

Ich behalte nur Worktrees, die aktive Kontexte repräsentieren. Wenn eine Aufgabe abgeschlossen oder auf unbestimmte Zeit pausiert ist, committe oder sichere ich den nötigen Zustand und entferne das Arbeitsverzeichnis.

Das Ziel ist nicht, die Zahl gleichzeitiger Branches zu maximieren. Es geht darum, berechtigte parallele Arbeit günstig und sicher zu machen.

## Verzeichnisse wechseln statt Kontext wiederaufbauen

Git Worktrees sind großartig, weil sie das Dateisystem an die Art anpassen, wie Entwicklungsarbeit tatsächlich abläuft.

Features werden unterbrochen. Hotfixes stehen an. Reviews müssen lokal ausgeführt werden. CI-Fehler müssen reproduziert werden. Werkzeuge und Agenten arbeiten zunehmend parallel. Ein einziges veränderliches Verzeichnis ist für all diese Kontexte ein unnötiger Engpass.

Mit Worktrees bekommt jede Aufgabe einen stabilen Ort. Die Git-Versionsgeschichte bleibt gemeinsam, während Arbeitsdateien, Indizes, Abhängigkeiten und Editorzustände getrennt bleiben.

Die wesentlichen Befehle sind kurz:

```shell
git worktree add ../feature -b feature/name origin/main
git worktree list
git worktree remove ../feature
```

Eine Anleitung mit einzelnen Befehlen für Review-Worktrees, Rebasing, Merging und Aufräumen findest du in [Git Worktree: A Practical Tutorial](/2026/06/30/Git-Worktree-A-Practical-Tutorial/).

Der gedankliche Wechsel ist noch einfacher:

> Hör auf, für jede Aufgabe den Branch zu wechseln. Wechsle stattdessen das Verzeichnis.

Sobald parallele Arbeit zum Alltag gehört, fällt es schwer, zu einem einzigen Checkout zurückzukehren.
