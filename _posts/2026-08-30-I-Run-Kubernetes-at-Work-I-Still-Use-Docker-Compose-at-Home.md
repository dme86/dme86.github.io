---
title: "I Run Kubernetes at Work. I Still Use Docker Compose at Home."
description: "Kubernetes is excellent, but infrastructure complexity should solve a real requirement. Why Docker Compose, Git, CI, Renovate, and deliberate storage choices are enough for my homelab."
layout: post
date: 2026-08-30 10:00:00 +0200
tags: [Docker, Kubernetes, Homelab, DevOps, CI/CD, Architecture]
excerpt_separator: "<!--more-->"
---

I run Kubernetes professionally. I still deliberately use Docker Compose at home.

That can sound like a contradiction. If Kubernetes is the right platform for serious production systems, why would I not use it for my own infrastructure? If I already know how to operate it, surely the learning curve is no longer an argument.

The answer is that knowing how to run a complex platform is not the same as needing one.

Kubernetes is excellent. It solves difficult scheduling, availability, reconciliation, policy, isolation, and organizational problems through a consistent API. I value those properties at work because the requirements justify the machinery.

My homelab has different requirements. I want reliable containers, reproducible configuration, automated deployment, controlled updates, centralized identity, sensible storage, and a system I can still understand when something fails on a quiet Sunday evening.

Docker Compose, Git, CI, and Renovate already give me most of the operational properties I care about there. Adding Kubernetes would give me more capability, but it would also give me more platform to own. Capability is useful only when it answers a requirement.

<!--more-->

## Kubernetes Is Genuinely Excellent

This is not an anti-Kubernetes article.

Kubernetes is one of the most important infrastructure platforms of the last decade because it provides a common control plane for running distributed workloads. It gives organizations a declarative API and a reconciliation model instead of a collection of unrelated deployment scripts and machine-specific procedures.

At work, Kubernetes solves real problems:

- scheduling workloads across a pool of compute capacity
- continuously reconciling declared and observed state
- replacing failed workloads and moving them away from failed nodes
- supporting high-availability application patterns
- providing declarative APIs for applications and infrastructure integrations
- enforcing policy through admission and runtime controls
- separating teams and environments through tenancy boundaries
- isolating workloads with resource, identity, and network controls
- integrating with ingress, observability, secrets, storage, and delivery ecosystems
- creating operational consistency across many applications and teams

Those are not theoretical benefits. Once an organization runs many services across multiple nodes, environments, and ownership boundaries, a shared orchestration platform can reduce inconsistency even though the platform itself is complex.

Kubernetes also changes application expectations. Pods are replaceable, scheduling is dynamic, health signals matter, and applications need to behave correctly across restarts and replicas. I covered that boundary in [What You as a Dev Should Know About Kubernetes](/2026/06/27/What-You-as-a-Dev-Should-Know-About-Kubernetes/).

The mistake is not choosing Kubernetes for Kubernetes-sized problems. The mistake is assuming that every container problem must become a Kubernetes problem.

## What My Homelab Actually Needs

My homelab does not serve multiple engineering teams. It does not need a shared compute market, dynamic placement across a large node pool, or policy enforcement across mutually untrusted tenants.

Its requirements are much smaller and more concrete:

- run containers reliably
- bring services back after a reboot
- keep configuration reproducible
- deploy changes automatically
- update services safely
- centralize authentication
- place data according to real performance and capacity requirements
- keep the complete system understandable

That last requirement matters more than it may appear.

Understandability is an operational property. Every controller, API, storage layer, network abstraction, certificate path, and upgrade process becomes something I must diagnose and maintain. In a company, that cost may be shared by a platform team and justified by hundreds of workloads. At home, I am the platform team, application team, security team, storage administrator, and person who wants to use the services.

The goal of a homelab is not to reproduce a large enterprise platform in a cupboard. The goal is to run the services I want with an operational burden I am willing to own.

For my current requirements, one capable Docker host is an appropriate failure and management boundary. I use a UGREEN NAS as that host and run the services with Docker Compose. There is no Kubernetes cluster hidden underneath it and no plan to introduce one merely because I can.

## My Actual Architecture

The runtime is simple, but the operating model is disciplined.

My Compose configuration lives in Git on a self-hosted Gitea instance. I change the Compose code locally, inspect the diff, commit it, and push it to Gitea. A Gitea Actions workflow reacts to the push. A self-hosted runner on the NAS then performs the deployment locally.

The flow is:

```text
change docker-compose.yaml
    ↓
git push
    ↓
Gitea
    ↓
Gitea Actions workflow
    ↓
self-hosted runner on NAS
    ↓
Docker Compose deployment
```

The runner can pull updated images and apply the Compose stack on the machine where the containers run. Conceptually, the deployment is intentionally unsurprising:

```shell
docker compose pull
docker compose up -d
```

The exact workflow must still handle failures, credentials, validation, and permissions responsibly. A runner able to control Docker is highly privileged. That trust boundary exists whether the deployment tool is a shell command, an agent, or a Kubernetes controller, so it should be kept narrow and protected accordingly.

What matters architecturally is that normal changes follow one visible route. I do not edit a container definition in a web UI, forget which flags I used, and hope I can reconstruct it later. The repository describes the intended stack, Git records its evolution, and CI applies an accepted revision.

[Gitea provides the repository and CI/CD capabilities](/2024/01/17/gitea-a-small-and-scaleable-DevOps-Platform-from-your-Homelab-to-Enterprise/) without requiring a much larger development platform. The runner executes on the target host, so I do not need another deployment control plane just to move a Compose file from Git into operation.

A reverse proxy sits in front of the services. Authentik provides centralized SSO and OIDC where applications support it. This gives me one identity layer instead of a growing collection of unrelated local accounts.

Renovate manages container and dependency updates. It proposes version changes through Git, where the same pipeline can validate and deploy them according to the rules I choose. That is much better than occasionally remembering to pull every `latest` tag and discovering several unrelated breaking changes at once.

None of these components makes Compose behave like Kubernetes. Together, however, they solve the actual delivery and operations requirements I have.

## HOT and COLD Storage Solve Different Problems

Storage is another place where it is easy to replace a direct requirement with a platform project.

I divide storage into two roles.

### HOT Storage

The HOT tier consists of:

- 2 × 1 TB NVMe SSD
- RAID1
- workloads and data where fast I/O matters

RAID1 gives the SSD tier redundancy while preserving the latency and throughput characteristics I want for I/O-sensitive workloads. Its capacity is smaller because capacity is not the primary requirement of this tier.

### COLD Storage

The COLD tier consists of:

- several terabytes of HDD storage
- RAID5
- ext4
- large data sets where capacity matters more than latency

The workloads do not all need the same storage behavior. Separating HOT and COLD storage makes the performance and capacity decision explicit without pretending that every byte deserves the fastest medium.

This architecture is not equivalent to distributed Kubernetes storage, and I do not present it as one. It does not turn local disks into a multi-node storage control plane. It does not provide CSI orchestration, dynamic volume placement across a cluster, or automatic movement of data with a rescheduled workload.

It solves a smaller problem directly.

I do not need Ceph, Longhorn, a CSI layer, or another storage platform when RAID1 SSD storage plus RAID5 HDD storage already meets my actual home requirements. Adding a distributed storage system to one main compute host would introduce monitors, controllers, network dependencies, upgrade procedures, failure modes, and recovery knowledge without giving me a useful distribution boundary.

RAID is also not a backup. Redundancy can keep storage available after some device failures, but it does not protect against deletion, corruption, compromised credentials, application mistakes, or loss of the complete system. Backup and recovery remain separate requirements regardless of whether the workload runs under Compose or Kubernetes.

The important engineering decision is to assign storage according to workload needs, not according to the most sophisticated architecture I know how to build.

## Simple Does Not Mean Undisciplined

There is a bad version of a simple homelab.

It consists of containers started from shell history, unversioned configuration copied between directories, mutable tags, manual changes through dashboards, forgotten credentials, and no reliable explanation of how to rebuild anything. Calling that setup "simple" does not make it maintainable.

That is not the simplicity I want.

I deliberately bring professional engineering practices into the homelab:

- infrastructure and configuration live in Git
- changes are visible, reviewable, and reproducible
- deployments are automated
- dependency and image updates are automated
- identity is centralized
- storage roles are explicit

Git gives me history and a declared configuration. CI makes the deployment path repeatable. Renovate keeps maintenance visible and incremental. Authentik reduces identity sprawl. The reverse proxy provides a consistent entry point. HOT and COLD storage make data placement intentional.

This resembles some GitOps principles, but I would not blur an important distinction: a push-triggered Compose deployment is not continuous reconciliation. If runtime state drifts after the workflow completes, Compose does not independently watch Git and restore the declared state. Kubernetes with a controller such as Flux provides a much richer model, as described in [GitOps: From Tribal Knowledge to Auditable Infrastructure](/2026/06/27/GitOps-From-Tribal-Knowledge-to-Auditable-Infrastructure/).

I accept that distinction because continuous reconciliation is not currently a requirement for this system. The normal path for change still goes through Git, and the deployment is automated enough to remain consistent and repeatable.

Renovate deserves the same precision. It can detect and propose updates, but it cannot prove that every new image works. As I argued in [Renovate Is Not the Problem. Your Pipeline Is.](/2026/06/27/Renovate-Is-Not-the-Problem-Your-Pipeline-Is/), dependency automation is only as trustworthy as the feedback and policy around it. Updates need validation, controlled rollout, observable results, and a recovery path.

Repository conventions help keep that operating model easy to use. A small, documented interface such as the one described in [Why Every Repository Should Have a Makefile](/2026/07/03/Why-Every-Repository-Should-Have-a-Makefile/) can give local work and CI the same commands for validation and deployment without hiding the underlying tools.

The result is deliberately boring infrastructure. That is a compliment. A deployment should not require me to rediscover how the system works.

## What Docker Compose Does Not Give Me

Choosing Compose means knowingly giving up capabilities.

I do not get automatic workload rescheduling between nodes. If the NAS is unavailable, another machine does not automatically take ownership of its containers.

I do not get multi-node high availability. Docker restart policies can bring a process back and the Docker daemon can restore services after a reboot, but neither solves the failure of the host itself.

I do not get Kubernetes' richer reconciliation model. Compose can apply a declared stack, but it is not a collection of controllers continuously driving every resource toward desired state.

I do not get Kubernetes-native policy. There is no admission controller evaluating every workload declaration against organization-wide rules before it reaches the runtime.

I do not get operators and custom controllers. Software that exposes lifecycle operations through Kubernetes APIs cannot use those patterns directly.

I do not get sophisticated scheduling. There are no affinity rules, taints, topology constraints, resource-aware placement decisions, or disruption budgets coordinating workloads across nodes.

I do not get distributed storage integrations. Data does not follow an application to another node through a Kubernetes storage abstraction.

I do not get Kubernetes networking and service abstractions. Compose networking and a reverse proxy are enough for my current topology, but they are not substitutes for cluster-wide Services, network policy, ingress controllers, or Gateway API implementations.

Deployments are also less sophisticated. `docker compose up -d` can recreate changed services, but it does not automatically provide the rollout semantics, readiness-based progression, and declarative rollback expectations of a well-configured Kubernetes Deployment. Safe updates therefore depend on the service design, Compose configuration, pipeline, health checks, observability, and my willingness to handle a failed change.

These are real trade-offs. Pretending otherwise would turn a deliberate choice into platform tribalism.

## Why I Am Comfortable With Those Trade-offs

Risk must be evaluated against the system that exists, not against an imaginary enterprise version of it.

My homelab has one main Docker host. Installing Kubernetes would not make that hardware highly available. A single-node cluster can restart Pods, but it cannot schedule them onto a node that does not exist. Multi-node Kubernetes would require additional compute, network, storage, quorum, and recovery decisions before it delivered meaningful host-level availability.

I also do not have multiple teams competing for resources or requiring strong tenancy boundaries. I do not need a general scheduling API because I already know where the workloads will run. I do not need an operator framework for a collection of services whose lifecycle fits Compose. I do not need a distributed storage platform when the storage is attached to the machine that runs the workloads.

That leaves a smaller operational problem:

- define the services clearly
- store the definition in Git
- validate and deploy changes consistently
- keep images current
- expose services through a controlled entry point
- centralize authentication
- put data on the right storage tier
- understand how to recover when a change or component fails

Compose plus the surrounding workflow solves that problem without introducing another API server, scheduler, controller manager, cluster network, ingress implementation, storage integration, policy layer, GitOps controller, or upgrade matrix.

Complexity should buy something. If I cannot name the requirement a component satisfies, its existence is difficult to justify.

## When I Would Use Kubernetes at Home

This decision is not permanent or ideological. Requirements can change.

I would consider Kubernetes at home if I had several compute nodes and genuinely wanted workloads to move between them. At that point, scheduling and reconciliation would solve a real placement problem.

I would consider it if services had real high-availability requirements and I was prepared to build the compute, network, load-balancing, and storage architecture required to support them. Kubernetes can coordinate an HA design, but it cannot manufacture redundancy from one machine.

I would use it when the purpose of the environment was to learn or test Kubernetes itself. A lab is allowed to be complex when studying that complexity is the requirement.

That includes testing:

- Kubernetes upgrades and failure modes
- GitOps controllers and reconciliation
- policy engines and admission behavior
- platform engineering patterns
- multi-cluster management
- ingress, networking, and service-mesh behavior
- operators and custom controllers
- distributed storage integrations

I have written practical examples such as [Learning GitOps with Flux, k3d, and the Flux CLI](/2026/06/18/Learning-GitOps-with-Flux-k3d-and-the-Flux-CLI/) precisely because a dedicated lab is useful for understanding these systems. A homelab deliberately designed as a Kubernetes lab has a different objective from a homelab designed primarily to run personal services.

The platform should follow the objective.

## Choose Complexity Deliberately

Kubernetes is excellent at solving Kubernetes-sized problems. My current homelab does not have those problems.

Docker Compose gives me a clear service definition and a runtime appropriate for one main host. Git makes the configuration visible and reproducible. Gitea Actions and a local runner automate deployment. Renovate turns updates into managed changes. Authentik centralizes identity. The reverse proxy gives services a consistent front door. HOT SSD storage and COLD HDD storage serve different data requirements without another storage control plane.

This is simpler than Kubernetes, but it is not casual infrastructure. The discipline lives in the operating model rather than in the number of controllers.

I know what I give up: multi-node scheduling, host-failure rescheduling, richer reconciliation, Kubernetes-native policy, operators, advanced rollout primitives, distributed storage integrations, and cluster networking abstractions. I am comfortable giving them up because they do not currently solve a problem I have.

The right architecture is not the one with the most capabilities. It is the simplest one that satisfies the real requirements, makes its trade-offs explicit, and leaves an operational burden its owner is willing to carry.
