---
title: "Installing Kyverno and Capsule with Flux"
description: "How to install policy and multi-tenancy tooling with Flux, then use Kyverno and Capsule with small practical examples."
layout: post
date: 2026-06-18 10:05:00 +0200
tags: [Kubernetes, GitOps, Flux, Security]
---

A local Flux setup becomes much more interesting once it manages more than demo applications.

In the previous article, [Learning GitOps with Flux, k3d, and the Flux CLI](/2026/06/18/Learning-GitOps-with-Flux-k3d-and-the-Flux-CLI/), I used a small k3d repository to explain the basic reconciliation loop. This article builds on that idea and adds two tools that make a cluster feel more like a platform:

- Kyverno for policy enforcement
- Capsule for Kubernetes multi-tenancy

<!-- more -->

The useful mental model is simple.

Flux keeps the desired state synchronized.

Kyverno decides whether resources are allowed, mutated, generated, or reported.

Capsule gives teams a tenant boundary inside a shared cluster.

Together, they let you turn a plain Kubernetes cluster into something closer to a self-service platform:

```text
Git
  -> Flux reconciles platform components
  -> Kyverno enforces cluster policy
  -> Capsule delegates namespaces and quotas to teams
  -> application teams deploy inside controlled boundaries
```

That is a strong pattern because it keeps the platform declarative. The cluster administrator does not click around in dashboards or run one-off Helm commands. The installation, policies, tenants, quotas, and examples all live in Git.

## What Kyverno Does

Kyverno is a Kubernetes-native policy engine.

The important part is "Kubernetes-native". You write policies as Kubernetes resources. You apply them with the same tools you already use. Flux can reconcile them like any other manifest.

Kyverno can do several things:

- validate resources
- mutate resources
- generate resources
- verify images
- produce policy reports
- enforce Pod Security Standards

The simplest use case is validation.

For example:

- require CPU and memory requests
- block privileged pods
- require labels on namespaces
- restrict image registries
- enforce non-root containers

Kyverno runs as admission webhooks. When a matching resource is created or updated, the Kubernetes API server sends the admission request to Kyverno. Kyverno evaluates the policy and either allows the request, denies it, mutates it, or records a report depending on the policy mode.

This is exactly the kind of thing that should be managed through GitOps. A policy is not just a runtime trick. It is part of the platform contract.

## What Capsule Does

Capsule solves a different problem.

Kubernetes namespaces are useful, but they are flat. A namespace can isolate some resources, but it does not give you a higher-level tenant object. Once you have multiple teams, you often need something more structured:

- who owns a group of namespaces
- how many namespaces a team may create
- which quotas apply across the tenant
- which labels or annotations must exist
- which resources are allowed
- which network policies or service restrictions apply

Capsule adds a cluster-scoped `Tenant` custom resource for that.

Instead of giving every team a separate cluster, Capsule lets you create controlled tenant spaces inside one cluster. Each tenant can own multiple namespaces, and Capsule can apply tenant-level constraints across those namespaces.

That makes Capsule a good fit for homelab platforms, internal development clusters, teaching environments, and smaller shared clusters where full cluster-per-team isolation would be too expensive or too much operational work.

## Why Use Both?

Kyverno and Capsule overlap only a little.

Kyverno is best at policy decisions:

```text
Is this pod allowed?
Does this workload define resources?
Is this namespace labeled correctly?
Is this image registry permitted?
```

Capsule is best at tenancy:

```text
Who owns this tenant?
How many namespaces can the team create?
What quota applies across all tenant namespaces?
Which tenant-level metadata should be inherited?
```

In practice, I would use them together:

- Capsule defines the team boundary.
- Kyverno defines cluster-wide safety rules.
- Flux defines how both tools and their configuration reach the cluster.

That separation keeps the platform understandable.

## Repository Shape

Using the same style as the Flux demo repository, I would add a security or platform layer under `infra`.

One possible layout:

```text
clusters/
  k3d-demo/
    infra/
      security.yaml
      tenants.yaml
infra/
  security/
    base/
      cert-manager.yaml
      kyverno.yaml
      capsule.yaml
      kustomization.yaml
  policies/
    kyverno/
      require-pod-resources.yaml
      kustomization.yaml
  tenants/
    solar/
      tenant.yaml
      kustomization.yaml
```

The exact names are not important. The important part is the separation:

- platform components go under `infra/security`
- policies go under `infra/policies`
- tenant definitions go under `infra/tenants`
- the cluster entrypoint references them through Flux `Kustomization` objects

This means Kyverno, Capsule, policies, and tenants all reconcile independently.

One detail matters when you model this in Flux: `Kustomization.dependsOn` points to other Flux `Kustomization` objects, not directly to `HelmRelease` objects. A common pattern is to put each Helm release in its own directory and then create a Flux `Kustomization` for that directory.

For example:

```text
Flux Kustomization "cert-manager" -> ./infra/security/base/cert-manager
Flux Kustomization "kyverno"      -> ./infra/security/base/kyverno
Flux Kustomization "capsule"      -> ./infra/security/base/capsule
```

Then policies can depend on the `kyverno` Kustomization, and tenants can depend on the `capsule` Kustomization.

## Install cert-manager First

Capsule uses admission webhooks. By default, it expects cert-manager for webhook certificates. You can configure Capsule differently, but for a normal platform setup I would install cert-manager explicitly.

With Flux, create an OCI `HelmRepository` and a `HelmRelease`.

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: cert-manager
  namespace: flux-system
spec:
  type: oci
  interval: 12h
  url: oci://quay.io/jetstack/charts
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: cert-manager
  namespace: flux-system
spec:
  interval: 10m
  targetNamespace: cert-manager
  releaseName: cert-manager
  chart:
    spec:
      chart: cert-manager
      version: v1.20.2
      sourceRef:
        kind: HelmRepository
        name: cert-manager
        namespace: flux-system
      interval: 12h
  install:
    createNamespace: true
    remediation:
      retries: 3
  upgrade:
    remediation:
      retries: 3
  values:
    crds:
      enabled: true
```

The exact version should be updated intentionally. The versions in this article are examples from the current chart ecosystem at the time of writing. Pin versions in Git, review upgrades, and let Flux apply them.

## Install Kyverno with Flux

Kyverno is available through the official Kyverno Helm repository.

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: kyverno
  namespace: flux-system
spec:
  interval: 12h
  url: https://kyverno.github.io/kyverno/
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: kyverno
  namespace: flux-system
spec:
  interval: 10m
  targetNamespace: kyverno
  releaseName: kyverno
  chart:
    spec:
      chart: kyverno
      version: 3.8.1
      sourceRef:
        kind: HelmRepository
        name: kyverno
        namespace: flux-system
      interval: 12h
  install:
    createNamespace: true
    remediation:
      retries: 3
  upgrade:
    remediation:
      retries: 3
  values:
    admissionController:
      replicas: 1
    backgroundController:
      replicas: 1
    cleanupController:
      replicas: 1
    reportsController:
      replicas: 1
```

For a local k3d cluster, one replica per controller is enough. For production, size this properly and read the Kyverno high availability guidance.

After Flux reconciles it:

```shell
flux get helmreleases -A
kubectl -n kyverno get pods
```

If you want to force the reconciliation while learning:

```shell
flux reconcile source helm kyverno -n flux-system
flux reconcile helmrelease kyverno -n flux-system
```

## A Simple Kyverno Policy

Start with an audit policy. Audit mode gives feedback without breaking developers immediately.

This policy checks that every container has CPU and memory requests and memory limits. I am using Kyverno's classic `ClusterPolicy` resource here because it is still common, easy to read, and widely represented in the policy examples. For a new production policy library, also look at Kyverno's newer CEL-based policy types.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-pod-resources
spec:
  validationFailureAction: Audit
  background: true
  rules:
    - name: require-requests-and-limits
      match:
        any:
          - resources:
              kinds:
                - Pod
      exclude:
        any:
          - resources:
              namespaces:
                - kube-system
                - kyverno
                - cert-manager
                - capsule-system
      validate:
        message: "CPU and memory requests, plus memory limits, are required."
        pattern:
          spec:
            containers:
              - resources:
                  requests:
                    cpu: "?*"
                    memory: "?*"
                  limits:
                    memory: "?*"
```

Put this in:

```text
infra/policies/kyverno/require-pod-resources.yaml
```

Then reconcile the policy path with Flux.

For example, create a Flux Kustomization for policies:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: kyverno-policies
  namespace: flux-system
spec:
  interval: 5m
  prune: true
  wait: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./infra/policies/kyverno
  dependsOn:
    - name: kyverno
```

That `dependsOn` is the important part. It assumes you have a Flux `Kustomization` named `kyverno` which installs the Kyverno Helm release. Policies should not reconcile before Kyverno and its CRDs exist.

Now inspect the policy:

```shell
kubectl get clusterpolicy
kubectl describe clusterpolicy require-pod-resources
```

Create a bad pod:

```shell
kubectl create namespace kyverno-demo
kubectl -n kyverno-demo run bad-nginx --image=nginx
```

Because the example uses `Audit`, the pod is allowed, but Kyverno records policy results. That is a good first step when introducing policies into an existing cluster.

When you are ready to enforce it, change:

```yaml
validationFailureAction: Audit
```

to:

```yaml
validationFailureAction: Enforce
```

Then reconcile:

```shell
flux reconcile kustomization kyverno-policies -n flux-system
```

Now the same pod should be denied. A valid pod needs resources:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: good-nginx
  namespace: kyverno-demo
spec:
  containers:
    - name: nginx
      image: nginx:1.27
      resources:
        requests:
          cpu: 50m
          memory: 64Mi
        limits:
          memory: 128Mi
```

Apply it:

```shell
kubectl apply -f good-nginx.yaml
```

This is a clean learning loop:

```text
write policy in Git
  -> Flux applies policy
  -> Kyverno evaluates admission requests
  -> bad resources are audited or denied
```

## Install Capsule with Flux

Capsule can also be installed through Flux as a Helm release. The project publishes an OCI chart under GitHub Container Registry.

First define the source:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: capsule
  namespace: flux-system
spec:
  type: oci
  interval: 12h
  url: oci://ghcr.io/projectcapsule/charts
```

Then define the release:

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: capsule
  namespace: flux-system
spec:
  interval: 10m
  targetNamespace: capsule-system
  releaseName: capsule
  chart:
    spec:
      chart: capsule
      version: 0.13.5
      sourceRef:
        kind: HelmRepository
        name: capsule
        namespace: flux-system
      interval: 12h
  install:
    createNamespace: true
    remediation:
      retries: 3
  upgrade:
    remediation:
      retries: 3
  driftDetection:
    mode: enabled
  values:
    crds:
      install: true
    manager:
      options:
        capsuleConfiguration: default
        users:
          - kind: Group
            name: capsule.clastix.io
```

This is enough for a local learning cluster. For production, I would spend more time on strict RBAC, webhook behavior, monitoring, and certificate management.

Capsule should depend on cert-manager. Model that in Flux:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: capsule
  namespace: flux-system
spec:
  interval: 5m
  prune: true
  wait: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./infra/security/base/capsule
  dependsOn:
    - name: cert-manager
```

This assumes you have a Flux `Kustomization` named `cert-manager` which reconciles the cert-manager Helm release directory.

Then inspect it:

```shell
flux get helmreleases -A
kubectl -n capsule-system get pods
kubectl api-resources | grep -i capsule
```

You should see the Capsule controller running and the `Tenant` API available.

## A Simple Capsule Tenant

Now create a tenant.

This example creates a `solar` tenant owned by the user `alice`. It allows at most two namespaces, adds labels to tenant namespaces, and defines a tenant-wide quota.

```yaml
apiVersion: capsule.clastix.io/v1beta2
kind: Tenant
metadata:
  name: solar
spec:
  owners:
    - kind: User
      name: alice
  namespaceOptions:
    quota: 2
    additionalMetadataList:
      - labels:
          tenant: solar
          cost-center: solar
          managed-by: capsule
  resourceQuotas:
    scope: Tenant
    items:
      - hard:
          requests.cpu: "4"
          requests.memory: 8Gi
          limits.cpu: "8"
          limits.memory: 16Gi
          pods: "20"
```

Put it in:

```text
infra/tenants/solar/tenant.yaml
```

Then reconcile it through Flux:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: tenants
  namespace: flux-system
spec:
  interval: 5m
  prune: true
  wait: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./infra/tenants
  dependsOn:
    - name: capsule
```

Check the tenant:

```shell
kubectl get tenants
kubectl describe tenant solar
```

For local testing, impersonate `alice`:

```shell
kubectl --as alice --as-group capsule.clastix.io create namespace solar-dev
kubectl --as alice --as-group capsule.clastix.io create namespace solar-test
```

The third namespace should fail because the tenant quota is two:

```shell
kubectl --as alice --as-group capsule.clastix.io create namespace solar-extra
```

Inspect what Capsule did:

```shell
kubectl get namespaces --show-labels | grep solar
kubectl get resourcequota -A
```

The important thing is that `alice` is not a cluster admin. Capsule gives her controlled self-service inside the tenant boundary.

## Combining Capsule and Kyverno

Now the combination starts to make sense.

Capsule lets `alice` create namespaces inside the `solar` tenant.

Kyverno still evaluates workloads created in those namespaces.

Try this after creating `solar-dev`:

```shell
kubectl --as alice --as-group capsule.clastix.io \
  -n solar-dev run bad-nginx --image=nginx
```

If the Kyverno policy is in `Audit`, the pod is created and reported.

If the policy is in `Enforce`, the pod is rejected because it has no resource requests.

Now apply a valid workload:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
  namespace: solar-dev
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 128Mi
```

Apply it as `alice`:

```shell
kubectl --as alice --as-group capsule.clastix.io apply -f nginx.yaml
```

That is the platform contract in action:

- Capsule says where the team may work.
- Capsule limits how much the team may consume.
- Kyverno says which workload shape is acceptable.
- Flux keeps all of that declared in Git.

## A Practical Reconciliation Order

The ordering matters.

I would structure the Flux Kustomizations like this:

```text
cert-manager
  -> kyverno
  -> capsule
  -> kyverno-policies
  -> tenants
```

You could install Kyverno and Capsule in parallel after cert-manager, but keeping a simple chain is easier while learning.

The dependency logic is:

- cert-manager first because Capsule needs webhook certificates
- Kyverno before Kyverno policies because policies need Kyverno CRDs
- Capsule before tenants because tenants need Capsule CRDs
- policies before tenant workloads because workloads should be checked

In Flux terms, that means `dependsOn`.

Example:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: tenants
  namespace: flux-system
spec:
  dependsOn:
    - name: capsule
    - name: kyverno-policies
```

That small amount of ordering removes a lot of race conditions.

## Useful Debugging Commands

For Flux:

```shell
flux get sources helm -A
flux get helmreleases -A
flux get kustomizations -A
flux logs --all-namespaces --follow
```

For Kyverno:

```shell
kubectl -n kyverno get pods
kubectl get clusterpolicies
kubectl get policyreport -A
kubectl get clusterpolicyreport
```

For Capsule:

```shell
kubectl -n capsule-system get pods
kubectl get tenants
kubectl describe tenant solar
kubectl get resourcequota -A
```

For a forced reconciliation:

```shell
flux reconcile helmrelease kyverno -n flux-system
flux reconcile helmrelease capsule -n flux-system
flux reconcile kustomization kyverno-policies -n flux-system
flux reconcile kustomization tenants -n flux-system
```

The first question should always be: which controller is unhappy?

If the HelmRelease is not ready, look at Flux and Helm events.

If Kyverno is installed but policy does not work, inspect the `ClusterPolicy`.

If Capsule is installed but namespace creation fails unexpectedly, inspect the `Tenant` status.

## What I Would Not Do First

I would not start by writing twenty policies.

I would not start with production-grade multi-tenancy.

I would not immediately enforce everything.

Start small:

1. Install cert-manager, Kyverno, and Capsule through Flux.
2. Add one Kyverno policy in `Audit`.
3. Add one Capsule tenant with one owner and a small namespace quota.
4. Create a namespace as that owner.
5. Deploy one bad pod and one good deployment.
6. Flip the Kyverno policy from `Audit` to `Enforce`.
7. Watch how the behavior changes.

That sequence teaches the operating model without burying you in platform design.

## Final Thoughts

Flux is the delivery mechanism. Kyverno and Capsule are platform controls.

That distinction matters.

Flux should not become a bag of random YAML. It should describe a coherent cluster model: sources, controllers, policies, tenants, apps, and dependencies.

Kyverno gives you admission control and policy reports.

Capsule gives you tenant boundaries and delegated namespace ownership.

Together they are a practical next step after a basic Flux demo. You move from "Flux deploys my app" to "Flux manages the rules of the cluster."

That is where GitOps starts to feel like platform engineering instead of just another deployment method.
