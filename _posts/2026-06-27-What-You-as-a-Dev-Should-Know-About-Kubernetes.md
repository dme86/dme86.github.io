---
title: "What You as a Dev Should Know About Kubernetes"
description: "How much Kubernetes application developers should understand, where platform ownership begins, and how both sides can work across that boundary."
layout: post
date: 2026-06-27 10:00:00 +0200
tags: [Kubernetes, DevOps]
---

Silos have a bad reputation in software organizations. They are blamed for slow delivery, poor communication, and tickets being thrown from one team to another.

But silos are not automatically bad. Complexity requires specialization. A developer cannot understand Kubernetes as deeply as an SRE while also owning product logic, APIs, data models, tests, UX concerns, and business requirements.

The problem is not specialization. The problem begins when specialization becomes an excuse to stop caring at the team boundary.

<!-- more -->

Good specialization means developers own the application, while SREs and platform engineers own the platform. Both sides understand enough of the shared boundary to collaborate effectively.

Bad silo thinking sounds like this:

- "I pushed the code, now it is an infrastructure problem."
- "The app is broken, so it is only the developers' problem."
- "Open a ticket for the other team and let them figure it out."

The goal is not to eliminate boundaries. The goal is to make them clear, but permeable.

For developers working in a company that deploys applications to Kubernetes, I would summarize that boundary like this:

> You build it, you understand how it runs.

That is not the same as "you build it, you operate the entire platform."

## The Sweet Spot

A developer need not become a Kubernetes administrator, SRE, or platform engineer. Cluster operations are a different specialization.

You do need to understand how your application behaves inside Kubernetes. That is the sweet spot: the direct runtime environment, not the entire platform providing it.

The direct environment is not especially mysterious:

- Your application runs as a container.
- The container runs inside a Pod.
- That Pod can be restarted, rescheduled, or replaced at any time.
- A Deployment controls the rollout and the desired number of replicas.
- A Service provides a stable internal network endpoint for changing Pods.
- An Ingress or Gateway may route external traffic to that Service.
- Configuration is usually injected through environment variables, ConfigMaps, or similar mechanisms.
- Secrets must not be baked into the image or committed to Git.
- Health checks determine whether the application is alive and ready to receive traffic.
- CPU and memory requests and limits influence scheduling and runtime behavior.
- Logs should go to standard output and standard error, and they should be useful.

These facts affect application design.

With multiple replicas, in-memory sessions may fail and uncoordinated background jobs may run more than once. Concurrency exposes unsafe assumptions. Shutdown must be graceful because Pods are replaced during rollouts, and startup must cope with temporarily unavailable dependencies.

Those are application concerns created by the runtime environment. The platform team can provide good defaults, but it cannot fix application semantics from the outside.

## The Kubernetes Basics Developers Should Actually Know

You need no academic tour of every Kubernetes resource, just a working vocabulary for the objects surrounding your application.

### Pod

A Pod is the smallest runtime unit most developers encounter. It usually contains one application container, perhaps with a sidecar. Pods are disposable, so do not treat their filesystem, IP address, or lifetime as permanent.

### Deployment

A Deployment manages replicas and rollouts. When a new image or configuration is released, it creates new Pods and removes old ones. If the new Pods never become ready, the rollout cannot complete.

### Service

A Service gives a set of Pods a stable internal address. Clients normally call the Service, not individual Pod IPs. A Pod may therefore be healthy while traffic still fails elsewhere in the path.

### Ingress or Gateway

An Ingress or Gateway routes external traffic toward a Service. Developers should understand their route, hostname, path, and target Service. Operating the routing implementation remains a platform responsibility.

### ConfigMap and Secret

These are common ways to externalize configuration. Environment-specific configuration belongs outside the image, and sensitive values need appropriate handling. A Kubernetes Secret is not permission to expose a value in logs, manifests, or source control.

### Readiness and Liveness Probes

Readiness answers: "Should this Pod receive traffic now?" Liveness answers: "Is this process stuck badly enough that Kubernetes should restart it?" They serve different purposes and should not be configured blindly against the same endpoint.

### Requests and Limits

Requests describe the resources an application expects and help Kubernetes place it. Limits cap resource use. Developers need not design cluster capacity, but they should know whether their application uses 200 MiB or 2 GiB of memory and how it behaves under load.

### Logs and Events

Application logs explain what the process is doing. Kubernetes events explain what is happening around the Pod, such as failed scheduling, image pull errors, or probe failures. Together they are usually the first diagnostic signals.

### Namespace

A namespace is commonly an isolation and ownership boundary. Developers should know which namespace contains their application in each environment.

## The First 10 to 15 Minutes of Debugging

Developers should not be expected to fix the cluster. They should be able to perform the first 10 to 15 minutes of meaningful analysis for their own application.

Identify the affected version and environment, check rollout and Pod state, read application logs and events, and look for recent image or configuration changes. The goal is to narrow down the failure, not assign fault.

Here are common examples.

### "The rollout is stuck"

A Deployment rollout often waits because the new Pods are not becoming ready. Check whether the new version starts correctly. Look at its logs, events, readiness status, image version, recent configuration changes, and any startup migrations.

The useful question is not "Who broke Kubernetes?" It is:

> Is my application becoming healthy in the expected runtime environment?

If the answer is no because the database is unavailable across the cluster, bring in the platform team with that evidence. If the new binary exits because an environment variable was renamed, the application team already knows where to look.

### "Readiness fails"

An application can be running without being ready. Kubernetes may keep the process alive but stop sending traffic because the readiness probe fails.

Typical causes include a wrong health endpoint, an unreachable dependency, slow startup, missing configuration, or a database connection problem. Developers should understand the difference between "the process exists" and "the application can serve requests."

A readiness endpoint should represent the application's ability to accept traffic. If it requires every downstream system to be perfect, a minor dependency failure can remove all replicas and make an incident worse.

### "CrashLoopBackOff"

`CrashLoopBackOff` means the container starts, crashes, and Kubernetes keeps restarting it with increasing delays.

Start with the application logs and startup path. Check for missing environment variables, invalid configuration, failed migrations, incompatible image changes, or an exception during initialization. You do not need to understand scheduler internals to understand that your process is crashing.

### "OOMKilled"

`OOMKilled` usually means the container exceeded its memory limit. Examine both application memory use and the configured limit.

The cause could be a leak, a large batch, workload growth, an unsuitable runtime setting, or a limit that no longer reflects reality. It is not automatically a platform problem, and raising the limit without understanding the workload is not a fix.

### "ImagePullBackOff"

`ImagePullBackOff` means Kubernetes cannot retrieve the referenced container image. Common causes include a wrong repository or tag, an image that CI never pushed, registry access problems, or missing credentials.

A developer should understand the chain from CI publishing an image to the Deployment referencing it. The platform team may own registry credentials, but the application team usually owns whether the artifact exists.

### "The logs are useless"

Logging is part of application ownership.

Logs should make startup, requests, dependency failures, configuration problems, and shutdown understandable. Structured logs with timestamps, levels, correlation IDs, and context are easier to work with than unstructured sentences.

Do not log secrets. Do not require shell access to a production container just to discover why the application failed to start. If the only message is "something went wrong," Kubernetes is not the main obstacle.

## Visibility Without Uncontrolled Access

Responsibility requires safe visibility. Telling an application team to investigate while hiding every runtime signal is not an ownership model.

Developers should usually have read-only access to their own application namespaces. Depending on the organization, that should let them:

- see rollout status and Deployment state
- list Pods and inspect their status
- read application logs
- read relevant events
- see basic Service, Ingress, or Gateway information
- recognize restarts, probe failures, and symptoms such as `OOMKilled`

That does not require broad cluster-admin access. The following capabilities should usually not be granted by default:

- general write access to the cluster
- manual `kubectl apply` in production
- deleting Pods as a normal operational habit
- reading Secrets
- executing commands inside production containers without explicit controls
- changing RBAC, ingress, storage, or other platform configuration

In a mature setup, production changes flow through CI/CD or GitOps using pull requests, approvals, and versioned configuration. Developers can investigate without gaining an uncontrolled path around that process.

GitOps should strengthen the boundary, not make it opaque. A developer should be able to connect a commit to an image, a deployment change, and the observed runtime state.

## What Should Remain Platform/SRE Territory

Some topics belong primarily to the people operating Kubernetes as a platform:

- cluster upgrades and node management
- CNI and network plugin internals
- ingress controller operations
- storage classes and CSI drivers
- RBAC design, admission controllers, and policy enforcement
- GitOps controller internals
- service mesh operations
- Prometheus, Loki, and Grafana platform setup
- multi-tenancy and cluster security architecture
- backup and disaster recovery for platform components

Developers may encounter these topics, but should not own them unless their role includes platform or SRE responsibilities.

The boundary works both ways. Application teams are not substitute cluster operators. Platform teams should not have to reverse-engineer application startup, memory behavior, database migrations, or domain-specific failures during every incident.

## Collaboration at the Boundary

The organizational goal is not to make developers perform platform work for free. It is to replace an unhealthy handoff:

> I merged it. Now it is infra's problem.

with a more useful position:

> My application runs on a platform. I understand enough of that boundary to help determine whether the problem is application behavior, configuration, resources, deployment, or platform.

Developers bring application knowledge. SREs and platform engineers bring platform knowledge. Shared vocabulary reduces blame, good first analysis shortens incidents, and clear ownership reduces frustration.

Platform teams should provide paved roads, documentation, dashboards, runbooks, sensible access, and standard deployment patterns. Application teams should provide meaningful health checks, useful logs, sane resource expectations, and behavior safe under restarts and multiple replicas.

Training should reflect that practical boundary. Long, generic "Kubernetes 101" sessions are less useful than working through real failure modes:

- Your deployment is stuck. What do you check?
- Your application is not ready. What does that mean?
- Your container was `OOMKilled`. Who needs to investigate what?
- Logs show missing configuration. Where should that configuration come from?
- Your application now has multiple replicas. Which assumptions break?

This teaches developers to reason about their software in context without turning them into cluster administrators.

## Know Where Your Application Lives

Developers need not operate nodes, design RBAC, debug a CNI, or maintain the monitoring stack. But if Kubernetes is where their software becomes real, they should build applications that start reliably, expose useful health signals, log clearly, handle restarts, respect resources, and can be debugged without immediately throwing the problem over the wall.

You do not need to know all of Kubernetes. But you should know enough about the part of Kubernetes where your application lives.
