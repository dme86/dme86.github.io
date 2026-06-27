---
title: "Why I Recommend Trunk-Based Development"
description: "Why short-lived branches, one main code stream, immutable artifacts, and explicit environment state usually produce safer delivery than branch-per-environment workflows."
layout: post
date: 2026-06-27 14:50:00 +0200
tags: [Git, DevOps, CI/CD, GitOps, Platform Engineering]
excerpt_separator: "<!-- more -->"
---

Using branches as environments sounds attractive at first.

A `dev` branch, a `test` branch, a `staging` branch, and a `prod` branch feel simple, visible, and comfortable. Developers merge into `dev`, testers approve what reaches `test`, and production receives whatever is finally merged into `prod`. The branch names appear to show exactly where software is in the delivery process.

It looks like control.

In many organizations, however, this model does not remove complexity. It hides complexity until it returns in uglier forms: drift between environments, unclear release states, repeated cherry-picking, back-merges, forgotten hotfixes, merge conflicts at the worst possible moment, and uncertainty about what was actually tested versus what is running in production.

That is why I recommend trunk-based development as the default for modern delivery. Code should flow through one main branch. Short-lived branches may represent work in progress, but environments should represent deployment state, not separate code realities.

<!-- more -->

## Why Environment Branches Feel Safe

Branch-per-environment workflows appeal to a reasonable instinct: teams want boundaries.

Development should be allowed to move quickly. Testing should receive something stable. Production should change only after approval. Mapping those boundaries to Git branches feels natural because branches are familiar, visible, and protected by access controls.

The model often looks like this:

```text
feature/* -> dev -> test -> staging -> prod
```

Each merge appears to promote the application. Branch protection can require different reviewers at each stage. CI can deploy each branch to its matching environment.

For a small application with infrequent releases, disciplined operators, and simple merge rules, this can work. I have seen teams operate it successfully.

The problem is that branches contain source history, not deployment state. An environment is a running instance of an artifact plus configuration, infrastructure, data, and external dependencies. Treating a source branch as the identity of an environment mixes two different concerns.

That confusion stays manageable only while every merge is perfectly ordered, every hotfix is propagated correctly, and nobody makes an exception. Real organizations make exceptions constantly.

## The Hidden Complexity of Branch-per-Environment

The first few promotions are usually easy. The long-term problems begin when delivery stops being perfectly linear.

### Environments Develop Different Histories

Suppose `dev` contains five new features. Testing approves three but blocks two. The team now needs to move only the approved changes toward `test`.

What happens next?

- cherry-pick the approved commits
- revert the blocked features
- create a release branch from an earlier commit
- merge everything and disable selected behavior
- wait until all five features are ready

Every option introduces a new coordination problem. The branch no longer represents a simple promotion stage. It represents a negotiated combination of changes.

Now add a production hotfix. The fix begins on `prod`, then must move backward through `staging`, `test`, and `dev`. One back-merge conflicts because development has already refactored the affected code. Another is forgotten because the incident ends at 03:00 and everyone is exhausted.

The source tree now contains several versions of reality.

> If dev, test, and prod contain different code histories, you are no longer promoting software. You are negotiating with several alternate timelines.

### Testing Loses a Stable Identity

A tester may approve commit `A` on the `test` branch. Before production promotion, another commit is merged into `test`, a conflict is resolved during the merge to `prod`, or the production pipeline rebuilds the application with different dependencies.

The organization may still say that "the release was tested," but what exactly was tested?

- the source tree before the final merge
- the source tree after conflict resolution
- an image rebuilt from the production branch
- an artifact with the same tag but different content

Without an immutable artifact identity, the answer is often weaker than teams realize.

### Cherry-Picking Becomes a Delivery System

Cherry-picking is a useful Git operation. It is a poor foundation for routine promotion.

Once teams regularly select individual commits for different environments, they must track dependencies between commits, preserve ordering, handle partial features, and remember which fixes have moved in which direction. Git records each operation, but it does not understand the business relationship between the selected changes.

The release process becomes an increasingly complex graph managed by convention and memory.

### Merge Conflict Risk Moves to the Right

Long-lived branches delay integration. Delayed integration means conflicts are discovered later, when changes are more expensive to untangle and release pressure is higher.

A conflict on a short-lived feature branch is an ordinary development problem. A conflict while merging `staging` into `prod` during a release window is an operational event.

Branch-per-environment does not eliminate integration risk. It postpones it.

### Branch Protection Becomes a False Proxy for Safety

Protected branches are valuable, but a protected `prod` branch does not prove that the resulting deployment is safe. It says that a specific Git operation followed specific rules.

Safety also depends on:

- automated tests
- artifact integrity
- configuration validation
- database compatibility
- progressive rollout
- runtime health
- observability
- rollback capability

When branch structure carries too much of the safety model, these mechanisms often receive less attention than they deserve.

## What Trunk-Based Development Actually Means

Trunk-based development means that developers integrate changes into one main code stream frequently.

For many teams, the trunk is `main`. Some organizations allow experienced developers to commit directly to it. Most use short-lived branches and pull requests. Both models can be trunk-based if branches remain small, live briefly, and merge back continuously.

Trunk-based development does **not** mean:

- every local edit goes straight to production
- code review disappears
- testing happens after release
- unfinished work must be visible to customers
- production changes without approval
- every service deploys on every commit

It means that the shared codebase is integrated early and kept releasable.

The practical rules are straightforward:

- `main` is the authoritative code stream
- branches represent short-lived work
- changes are small enough to review and integrate quickly
- CI protects the releasable state of `main`
- incomplete behavior is separated from deployment
- releases select immutable artifacts, not alternate source histories

Branches should represent work in progress, not environments.

Environments are deployment targets, not parallel realities.

## Control Moves to Better Places

The strongest objection to trunk-based development is usually about control. If there is only one main branch, what stops an unsafe change from reaching production?

The answer is not "nothing." The answer is that control should exist in mechanisms designed to evaluate and operate software:

- pull-request review
- CI quality gates
- unit, integration, contract, and end-to-end tests
- static analysis and security scanning
- feature flags
- deployment approvals
- immutable artifacts
- progressive delivery
- runtime health checks
- observability
- automated rollback

Trunk-based development does not remove control. It moves control to better places.

A branch can tell us that two histories are different. It cannot tell us whether an application is healthy under production traffic. A release approval can verify organizational intent. A canary rollout can verify runtime behavior. Metrics and traces can show whether the change improved or damaged the system.

Modern delivery needs all of these signals.

## Build Once, Promote the Same Artifact

The most important companion to trunk-based development is immutable artifact promotion.

A clean delivery model builds one artifact from a commit on `main`. That exact artifact moves through development, testing, staging, and production. It is not rebuilt for each environment.

The bad pattern looks like this:

```text
dev branch  -> build dev image  -> deploy to dev
test branch -> build test image -> deploy to test
prod branch -> build prod image -> deploy to prod
```

Each environment receives something built from a different source history at a different time. Dependency downloads may differ. Build tools may have changed. Base-image tags may resolve to new content. Even if the source looks similar, the artifacts are not necessarily identical.

The better pattern is:

```text
main -> build one immutable image
            |
            +-> deploy to dev
            +-> promote to test
            +-> promote to staging
            +-> promote to prod
```

The environment-specific differences should be runtime configuration: replica counts, resource limits, endpoints, feature availability, credentials, and similar deployment concerns. The application binary remains the same.

This provides a much stronger statement:

> Production runs the exact artifact that passed the earlier stages.

Promotion is now a decision about a known object, not a request to reproduce it.

## Version Numbers, Git Tags, and Image Digests

Teams often mix three different identities:

- a Git commit
- a release version or Git tag
- a container image identity

They are related, but they serve different purposes.

### Git Commits

A commit identifies source state. It is the right place to trace code history, review context, and build input.

### Versions and Git Tags

A version such as `2.7.1` is useful for humans. It communicates release intent, supports changelogs, helps customer support, and gives teams a shared name for a release.

A Git tag can connect that human version to a source commit.

### Image Tags

Container image tags such as `2.7.1`, `dev`, `staging`, or `latest` are convenient references. But tags can be moved unless registry policy prevents it. A tag is a label, not inherently an immutable identity.

### Image Digests

A digest such as:

```text
registry.example.com/my-app@sha256:abc123...
```

identifies image content. If the content changes, the digest changes.

That leads to a simple rule:

> Version numbers are for humans. Digests are for truth.

This does not mean hiding versions. A good image should carry OCI metadata such as the source revision, version, creation time, and repository URL. Applications can expose build information on a status endpoint. Dashboards can show a friendly version next to the digest and commit. Release notes can link all three.

Humans should be able to say, "dev runs version 2.7.1." The delivery system should be able to prove that dev runs digest `sha256:abc123`.

## A GitOps Example with Kubernetes

Trunk-based development and GitOps fit together naturally because they separate application source from environment state.

The application repository uses `main`:

```text
app-repo:
  main
    -> CI tests commit 8f31c2d
    -> CI builds one image
    -> registry.example.com/my-app@sha256:abc123
```

The build can attach useful metadata:

```text
version: 2.7.1
revision: 8f31c2d
digest: sha256:abc123
```

A separate GitOps repository declares what runs in each environment:

```text
gitops-repo:
  environments/dev/my-app/values.yaml  -> sha256:abc123
  environments/test/my-app/values.yaml -> sha256:abc123
  environments/prod/my-app/values.yaml -> sha256:abc123
```

The actual YAML might look like:

```yaml
image:
  repository: registry.example.com/my-app
  digest: sha256:abc123
```

Promotion means changing the digest in environment configuration.

Flux or Argo CD then reconciles that declared state into Kubernetes. The controller can report which Git revision it observed and whether the workload became ready. The GitOps history records when the digest entered each environment, who approved it, and which configuration accompanied it.

The key property is that promotion does not rebuild the image.

For example:

1. CI builds `sha256:abc123` from `main`.
2. Automation proposes that digest for `dev`.
3. Integration tests run against `dev`.
4. A pull request promotes the same digest to `test`.
5. Test approval allows promotion to `prod`.
6. Flux or Argo CD reconciles production to `sha256:abc123`.

Environment state remains explicit without creating environment branches in the application repository.

This model also makes rollback clearer. Reverting production means declaring the previous known-good digest. It does not require reconstructing an old branch state and rebuilding an image that merely resembles the previous release.

## What About Configuration?

"Build once, promote the same artifact" requires a clean boundary between application code and environment configuration.

Configuration that legitimately differs between environments should be injected at deployment or runtime:

- service endpoints
- feature flags
- resource requests and limits
- replica counts
- log levels
- credentials and secret references
- environment-specific policy

The GitOps repository can declare these differences through Kustomize overlays, Helm values, or plain manifests.

This does not justify completely different application behavior in every environment. If environment configuration grows into a second programming language, testing becomes unreliable again. Differences should be intentional, minimal, and visible.

The ideal is not identical environments at any cost. The ideal is that meaningful differences are explicit rather than hidden in branch history or manual settings.

## Common Developer Objections

### "I Tag a Version in Git. How Do I Know Which Version Runs in Dev?"

Keep the human-readable version visible.

Add version and commit metadata to the image. Expose it through application diagnostics. Put it in Kubernetes labels and annotations. Show it in dashboards, deployment views, GitOps status, and release notes.

For example:

```yaml
metadata:
  labels:
    app.kubernetes.io/version: "2.7.1"
  annotations:
    delivery.example.com/revision: "8f31c2d"
    delivery.example.com/image-digest: "sha256:abc123"
```

Then use the digest as the deployment identity.

The answer to "what runs in dev?" can be friendly and precise:

```text
Version: 2.7.1
Commit: 8f31c2d
Image: sha256:abc123
```

Do not make a mutable tag the only source of truth.

### "Does Trunk-Based Development Mean No Safety?"

No. It means safety is built into integration and delivery instead of being approximated by long-lived branches.

A mature trunk-based workflow may have:

- required pull-request reviews
- mandatory CI checks
- policy enforcement
- signed artifacts and provenance
- deployment approvals
- staged environment promotion
- canary or blue-green rollout
- service-level health checks
- automatic rollback

This is usually more control than a protected `prod` branch provides, not less.

### "What About Unfinished Features?"

Deployment and release are different decisions.

Code can be deployed without exposing unfinished behavior. Common techniques include:

- feature flags
- configuration switches
- internal-only routes
- permissions
- dark launching
- branch by abstraction
- incomplete code paths that are not activated

Feature flags require ownership. Old flags must be removed, variants must be tested, and critical flags need safe defaults. But managed carefully, they allow integration to happen earlier without forcing product release.

The alternative is often a long-lived feature branch that accumulates conflicts and receives less realistic testing.

### "What If Main Breaks?"

Treat a broken `main` branch as an operational problem.

CI should be fast enough to catch common failures before merge. Changes should be small enough to revert. Teams should prioritize restoring the trunk over adding more changes on top of a failure.

The objective is not to claim that `main` never breaks. The objective is to make breakage visible, rare, and short-lived.

### "We Need to Test Several Features Together"

Create an integration environment from selected artifacts or feature configurations. Do not create a permanent alternate source history unless the problem genuinely requires one.

Ephemeral environments, feature flags, and explicit release manifests are often better tools for integration testing than a long-lived branch containing an unstable mixture of work.

### "We Cannot Deploy Every Commit"

You do not have to.

Continuous integration and continuous deployment are related but distinct. A team can integrate every change into `main`, build immutable artifacts continuously, and promote only selected artifacts according to its release cadence.

Trunk-based development requires frequent integration. It does not require uncontrolled release.

## Release Branches Are Not Environment Branches

There are valid reasons to maintain more than one long-lived code line.

A product may support versions `3.x` and `4.x` simultaneously. A regulated release may enter a stabilization period while development continues. An embedded product might need maintenance branches for hardware already in the field.

These are release lines, not environment identities.

A release branch represents a supported version of the software. It can be built into an immutable artifact and promoted through multiple environments. Dev, test, and production still do not need separate source histories for that release.

This distinction prevents legitimate version-support requirements from becoming an excuse for environment branches everywhere.

## When Branch-per-Environment Can Work

Branch-per-environment is not universally wrong.

It can work when an organization has:

- a strictly orchestrated release train
- strong ownership of forward- and back-merges
- clear rules for hotfix propagation
- automation that verifies ancestry and content
- infrequent, carefully scheduled releases
- a product model that genuinely requires distinct code lines
- people explicitly responsible for resolving drift

Some platform configuration repositories also use environment branches successfully because their change model, tooling, and access controls were designed around that structure.

But this is not a low-maturity shortcut. It is a process that requires high maturity to remain safe.

Teams often adopt it because it feels easier than building artifact promotion, feature management, and proper delivery controls. They then pay for those missing capabilities through manual Git coordination.

That is why I consider branch-per-environment the wrong default for modern cloud-native application delivery.

## A Practical Migration Path

Moving from environment branches to trunk-based development does not need to happen in one disruptive step.

### 1. Identify the Current Release Identity

Determine how the organization currently answers:

- which source commit is in each environment
- which artifact was built from that commit
- whether artifacts are rebuilt during promotion
- which hotfixes exist only on certain branches

If those questions are difficult, document the uncertainty before changing the workflow.

### 2. Establish `main` as the Integration Branch

Choose one authoritative code stream. Reduce feature branch lifetime and encourage smaller pull requests.

### 3. Make the Build Reproducible

Pin dependencies, base images, and toolchains where practical. Record commit and version metadata in every artifact.

### 4. Introduce Immutable Artifact Identity

Store images in a registry that preserves digests. Stop overwriting release tags. Record the digest produced by CI.

### 5. Separate Build from Deployment

Build once. Make deployment pipelines accept an existing artifact identity instead of running the build again.

### 6. Declare Environment State

Use a GitOps repository, release manifest, or deployment system to record which artifact belongs in each environment.

### 7. Add Promotion Controls

Attach tests, approvals, policies, and progressive rollout to the transition between environments.

### 8. Deal with Unfinished Work

Adopt feature flags or another explicit mechanism before forcing long-lived feature branches to disappear.

### 9. Remove Environment Branches Gradually

Once artifact and environment identity are reliable, environment branches become redundant. Retire them one at a time rather than keeping them as a parallel path "just in case."

## The Operational Perspective

From a DevOps or SRE perspective, the most valuable outcome is certainty.

During an incident, I want to know exactly what is running. I do not want to infer it from a branch name, a mutable tag, or the last successful pipeline. I want the commit, version, artifact digest, configuration revision, deployment event, and runtime health.

During a rollback, I want to select a known-good immutable artifact. I do not want to rebuild an old branch and hope external dependencies still resolve the same way.

During an audit, I want to show how a specific artifact moved through environments and which controls approved it. I do not want to reconstruct a trail of merges and cherry-picks across four long-lived branches.

During normal development, I want conflicts discovered while context is fresh. I do not want integration deferred until release day.

Trunk-based development supports these goals because it keeps source integration simple and makes deployment state explicit.

## Conclusion

Branch-per-environment feels safe because the control is visible in Git. But visible structure is not the same as reliable delivery.

When dev, test, staging, and production become separate code histories, teams spend increasing effort deciding which changes exist where. Testing becomes harder to identify, hotfixes must travel in several directions, and promotion quietly turns into rebuilding software from a different branch.

Trunk-based development offers a cleaner model:

- one integrated code stream
- short-lived branches for work in progress
- one immutable artifact per build
- explicit promotion through environments
- human-readable versions
- content-addressed digests
- safety through tests, review, feature flags, observability, and rollback

The goal is not to push everything directly to production. The goal is to integrate early, keep the codebase releasable, and promote known artifacts with deliberate controls.

Branches should represent work in progress, not environments. Environments should represent deployment state, not parallel realities.
