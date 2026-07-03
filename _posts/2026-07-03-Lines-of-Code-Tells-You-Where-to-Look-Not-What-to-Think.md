---
title: "Lines of Code Tells You Where to Look, Not What to Think"
description: "Lines of Code can reveal the size and movement of a software system, but maintainability, ownership, feedback loops, architecture, operability, and security determine its health."
layout: post
date: 2026-07-03 10:00:00 +0200
tags: [Software Engineering, Architecture, Linux, Maintainability, Metrics]
excerpt_separator: "<!--more-->"
---

The current discussion about the Linux kernel reaching another milestone measured in tens of millions of lines of code follows a familiar pattern. Some people treat the number as evidence of extraordinary engineering. Others present it as proof that Linux has become bloated, incomprehensible, or badly designed.

Both reactions give the number more meaning than it has.

Any specific total needs a qualification: it depends on the kernel revision, the counting tool, and which languages and file types are included. More importantly, the Linux source tree contains much more than the code running on a typical machine. It contains drivers for vast amounts of hardware, architecture-specific implementations, filesystems, platform support, comments, build files, generated code, tests, build scripts, documentation, and code excluded by a particular configuration. Much of it will never be built for one machine, and not everything that is built will be loaded.

The real problem is that people often confuse **large codebase** with **bad codebase**. Lines of Code can indicate rough size, provide context, or suggest that a subsystem deserves closer inspection. It cannot tell us whether the software is maintainable, well-owned, secure, testable, operable, or safe to change.

<!--more-->

The real measure of software health is not how many lines of code exist, but how safely, quickly, and confidently humans can understand, operate, and change the system.

That standard is harder to reduce to a dashboard number. It is also much closer to the problems engineers actually face.

## 1. Maintainability Is the Most Important Signal

A software system exists to be changed.

Even software considered "finished" still encounters new hardware, security vulnerabilities, operating environments, dependencies, regulations, failure modes, and user expectations. If a system cannot be changed safely, it becomes a liability no matter how small or large it is.

Maintainability begins with readability, but it does not end there. An engineer needs to understand what a piece of code does, where its responsibilities begin and end, how data moves through it, and which assumptions other components make about its behavior. Clear module boundaries, low coupling, good names, simple control flow, and unsurprising interfaces reduce the amount of context required to make a correct change.

The most maintainable solutions are often boring. They use familiar structures, make important state visible, and avoid cleverness that saves a few lines while transferring the cost to every future reader. Experienced engineers should be able to locate the right place for a change without first reconstructing the entire system from scattered side effects.

This is where raw size becomes misleading. A 5,000-line application with implicit global state, tangled callbacks, ambiguous names, and no clear boundaries can be nearly impossible to modify safely. A much larger system can remain manageable when it is divided into coherent parts with stable responsibilities.

The Linux kernel illustrates this distinction. Nobody understands every part of the complete tree in equal depth. That is not the operating model. Engineers work in and around specific subsystems with their own concepts, interfaces, maintainers, and review practices. Architecture-specific code is separated from common code. Drivers are organized by type and device family. Filesystems and networking have recognizable boundaries. The separation is imperfect, as it is in every old and active system, but it makes the tree more understandable than its total line count suggests.

The important question is not:

> How many lines are there?

It is:

> Can people understand the relevant part of the system well enough to change it safely?

Maintainability matters more than Lines of Code because it directly determines the cost and risk of every future change. LoC merely tells us approximately how much text exists.

## 2. Ownership Is Critical

Code without clear ownership becomes dangerous over time.

Someone must be responsible for reviewing changes, understanding risks, deciding what belongs in a component, handling deprecations, and reacting when it breaks. Ownership does not mean that one person must write every change or remain permanently on call. It means that responsibility is explicit and that there is a credible path for decisions, review, escalation, and stewardship.

Unowned code tends to degrade in predictable ways. Changes are approved by whoever happens to be available. Risky work is postponed because nobody feels authorized to make the decision. Dependencies age. Warnings accumulate. Incidents bounce between teams. Eventually the component becomes something everyone depends on and nobody wants to touch.

A small unowned service can therefore be riskier than a large subsystem with active maintainers. The service may have only a few thousand lines, but if nobody understands its production behavior or accepts responsibility for it, its small size offers little protection.

Large projects such as the Linux kernel scale through ownership. Subsystem maintainers provide review paths and responsibility boundaries. Changes normally travel through people who understand the affected area before moving toward the mainline. The `MAINTAINERS` information and tools such as `get_maintainer.pl` help contributors identify the relevant reviewers and mailing lists. Long-term stewardship preserves context that no line counter could measure.

This model is not frictionless. Maintainers can be overloaded, subsystem boundaries can be disputed, and review capacity is finite. Those are real health signals. A large subsystem growing faster than its maintainer and review capacity deserves attention—not simply because it contains many lines, but because ownership may no longer match responsibility.

Ownership matters more than Lines of Code because software is sustained by people, not by file statistics. A codebase with accountable, knowledgeable maintainers has a mechanism for staying healthy. An unowned codebase does not.

## 3. Tests and Feedback Loops Matter More Than Size

Good tests turn change from gambling into engineering.

They do not prove the absence of defects, but they reduce uncertainty and shorten the distance between introducing a problem and learning about it. Unit tests can validate local behavior. Integration tests exercise boundaries between components. Regression tests preserve knowledge about failures that must not return. Compatibility tests protect contracts. Smoke tests answer the basic question of whether a built system can start and perform its essential work.

Continuous integration connects those checks to every change. Fast, reliable feedback lets an engineer make a small modification, observe the consequences, and correct mistakes while the context is still fresh. Slow or flaky feedback changes behavior in the opposite direction: developers batch work, distrust failures, skip tests, and rely on manual confidence.

The relevant question is not:

> How many lines does this system have?

It is:

> How quickly do we know whether a change broke something?

The kernel faces an unusually difficult version of this problem. Its possible combinations of architectures, compilers, configuration options, modules, devices, and workloads are too numerous for one test environment. Its feedback system therefore has many layers: local builds and tests, static analysis, multiple build configurations, subsystem test suites, KUnit, automated test infrastructure, review, release candidates, distribution testing, and reports from a very large user and developer community.

That does not make kernel changes safe by definition. It creates ways to discover mistakes before or after integration and to turn failures into regression knowledge.

A large system with strong feedback loops can be safer to change than a small system where every deployment is an act of faith. Test quality and feedback speed matter more than raw LoC because they provide evidence about the behavior of a change. Lines of Code provides none.

## 4. Architecture and Coupling Define the Cost of Change

Complexity is often created by hidden dependencies, unclear boundaries, and cascading side effects—not by the number of lines alone.

A highly coupled 20,000-line system can be harder to change than a modular two-million-line system. If every component reaches into every other component's data, a local request is never truly local. The engineer must understand the whole dependency web, test a wide blast radius, and expect consequences in places that appear unrelated.

Healthy architecture constrains that problem. Modules group related responsibilities. Interfaces make assumptions explicit. Dependency direction prevents lower-level details from controlling higher-level policy. Configuration boundaries reveal which variants are intentional. Separation of concerns keeps storage, transport, policy, and presentation decisions from collapsing into one mechanism.

The test of an architecture is not whether its diagram looks elegant. It is whether engineers can answer practical questions:

- Where should this change live?
- Which components can it affect?
- Which interface expresses the contract?
- Can the implementation be tested in isolation?
- Can one part evolve without coordinating a release of everything else?

The Linux kernel source tree is huge because its problem space is huge: it supports many architectures, devices, drivers, filesystems, platforms, and configurations. [Kconfig](https://docs.kernel.org/kbuild/kconfig.html) and the build system determine which portions apply to a particular target. Loadable modules defer more choices until runtime. Subsystem boundaries keep many hardware-specific details out of unrelated code.

Not all kernel code is built, and not all built code is loaded. A large source tree therefore does not automatically mean a bloated running system. Repository size, compiled artifact size, loaded code, memory use, and runtime complexity are different measurements.

Architecture determines whether a codebase grows as a set of understandable parts or as one large knot. That makes coupling and boundaries stronger health indicators than the number of lines contained inside them.

## 5. Documentation Matters, Especially Decision Documentation

The most valuable documentation does not repeat what a nearby function already says. It preserves context that the code cannot express clearly by itself.

Good documentation explains:

- why the system exists
- why a particular trade-off was made
- where important boundaries lie
- how the system is operated
- who owns it
- which failure modes are expected
- what should not be changed casually

Architecture Decision Records preserve the alternatives and constraints behind important choices. Architecture notes explain how components relate. Onboarding documents give new maintainers a usable map. Runbooks and troubleshooting guides turn operational knowledge into a repeatable response. Documentation close to an interface can explain invariants that are technically possible to violate but operationally disastrous.

This matters most where context is expensive to rediscover. Code can show that a workaround exists; it may not show that a particular device shipped broken firmware, that an external contract cannot be changed until 2029, or that a seemingly redundant check prevents a failure observed once every six months.

The kernel contains extensive documentation, in-tree comments, subsystem guidance, contribution rules, and history. It also carries the inevitable documentation gaps of a system developed over decades. Its scale makes preservation of intent especially valuable because the original author may be unavailable and the relevant hardware may be rare.

Bad documentation can become stale noise, and documentation volume is not a quality metric either. Good documentation preserves decisions and reduces future fear. That is more useful than knowing how many comment lines a counting tool included in the total.

## 6. Operability Matters

Software is not healthy merely because it compiles or passes CI. Production introduces real data, partial failures, overloaded dependencies, unusual timing, hostile input, and behavior that no pre-release environment reproduces exactly.

Healthy software must be observable and debuggable. Logs should provide useful context without becoming an unsearchable flood. Metrics should show service behavior, capacity, errors, and saturation. Traces should help follow work across boundaries where that cost is justified. Dashboards and alerts should direct attention toward conditions requiring action instead of converting every variation into noise.

Operability also includes what happens after a problem is detected:

- Are there useful runbooks?
- Can a deployment be stopped or rolled back safely?
- Are releases gradual enough to limit the blast radius?
- Can responders identify the responsible component and owner?
- Does incident response produce fixes, tests, and better operational knowledge?

The details differ for an operating-system kernel and a web service, but the principle does not. Kernel logs, tracing facilities, performance counters, crash dumps, dynamic debugging, and subsystem-specific diagnostics give operators and developers ways to inspect behavior under real workloads. A driver that is easy to read but impossible to diagnose on failing hardware is not operationally healthy.

A system that cannot be operated safely is fragile regardless of its LoC count. The health of production software depends on whether humans can understand what it is doing when reality starts biting.

## 7. Security and Supply Chain Matter

Software health also depends on whether the system can be patched, updated, scanned, signed, and trusted.

That requires more than finding vulnerabilities after publication. Teams need to know which dependencies and artifacts they ship, where those artifacts came from, how they were built, which permissions they require, and how quickly a vulnerable component can be replaced.

The practical concerns include:

- dependencies and known CVEs
- secret handling
- least-privilege permissions
- Software Bills of Materials
- artifact signing
- build provenance
- reproducible or otherwise verifiable build processes
- reliable update and patch mechanisms

Patchability is a particularly important health property. A small, old codebase that can no longer be built reproducibly or deployed without a manual ritual is a security risk even if vulnerability scanning reports little. Its apparent simplicity hides the fact that the organization cannot respond safely when a defect is found.

The kernel again demonstrates why size alone is inconclusive. Its broad hardware and platform support creates a large attack surface in the complete source tree, but configuration determines which parts are present on a system. Security still depends on the relevant configuration, exposed interfaces, maintenance status, review quality, update path, distribution practices, and the speed with which fixes reach running machines.

A large system with a disciplined security and supply-chain process can be safer than a small system full of unknown dependencies and manual release rituals. LoC says almost nothing about that distinction.

## 8. Where Lines of Code Actually Fits

Lines of Code is not useless. It is useful when treated as context rather than judgment.

It can help us:

- understand the rough size of a codebase
- notice unusually large subsystems
- compare generated code, vendored code, tests, documentation, and handwritten production code
- spot unusual growth patterns and ask why they happened
- identify areas that may need more maintainers, tests, documentation, or review capacity
- start a conversation about complexity

These uses require segmentation. A single repository-wide number hides more than it reveals. A million lines of generated protocol bindings have different maintenance implications from a million lines of handwritten business logic. Test code, vendored dependencies, documentation, migration files, and platform-specific implementations should not be treated as if they represented the same kind of complexity.

The Linux kernel is a useful example precisely because the headline total collapses so many categories. Hardware support, architecture-specific code, generated or repetitive structures, documentation, tests, and code used only by particular configurations all contribute to the apparent size. A person reading the total does not learn how much code is compiled for a laptop, how much is loaded, how much executes during a workload, or which subsystem carries the most change risk.

### Growth Is a Prompt for Investigation

Looking at Lines of Code over time can be useful, but only as a starting point.

If a subsystem grows quickly, that does not automatically mean it is getting worse. New hardware support may require new drivers. A new architecture may add substantial platform code. Generated files may have changed. Tests and documentation may have expanded. Legitimate features may need more implementation.

Growth can also reveal copy-paste, poor abstractions, scope creep, missing ownership, weak boundaries, or an area where review and testing capacity has failed to keep pace. The graph cannot distinguish these explanations. Engineers must investigate.

A sudden increase in LoC should not trigger panic. It should trigger better questions:

- What changed?
- Is this handwritten code, generated code, tests, documentation, or vendored code?
- Is the growth intentional?
- Is the area still maintainable?
- Do we have enough ownership, tests, and review capacity around it?
- Did we reduce complexity, or did we just move it somewhere else?

LoC growth is not a problem by itself. LoC shrinkage is not automatically good either. Deleting obsolete code can remove complexity and maintenance cost. It can also move complexity into dependencies, code generators, configuration, build logic, or external services. Replacing 10,000 explicit lines with a 300-line metaprogram may improve the system—or make it much harder to understand and debug.

Lines of Code tells us that something changed. It does not tell us whether the change improved the system.

> Lines of Code is a question generator. It tells us where to look, not what to think.

For the Linux kernel, the interesting question is not whether the repository contains many lines. Of course it does: it implements an enormous range of hardware, architecture, filesystem, networking, security, memory-management, and platform behavior accumulated over decades.

The interesting questions are whether the relevant parts are maintained, reviewed, tested, documented, and safe to change. Kconfig, modularity, subsystem maintainers, review processes, responsibility boundaries, and long-running engineering discipline are what make that scale possible. Where those mechanisms weaken, the resulting risk is worth discussing regardless of the subsystem's line count.

## Software Health Is a Human Capability

Lines of Code is not useless, but it is a low-resolution metric. It can reveal size and movement, but not health. It is useful as context, not as a KPI.

Treating LoC as a quality score encourages bad decisions. It rewards deletion without asking where complexity moved. It punishes tests and documentation for adding lines. It makes generated code look like human maintenance burden. It reduces a multidimensional engineering system to its weight on disk.

The better question is:

> Can humans still understand this system, own it, test it, operate it, secure it, and change it without fear?

The answer tells us far more about software quality than any line counter can.
