---
title: "Managing Multiple Kubernetes Clusters with Flux"
description: "How to structure a Flux repository for dev, test, and prod clusters, and how to decide which namespaces and apps land where."
layout: post
date: 2026-06-18 18:00:00 +0200
tags: [Kubernetes, GitOps, Flux]
---

Running one Flux-managed cluster is useful.

Running three Flux-managed clusters from the same repository is where the repository structure starts to matter.

The moment you have `dev`, `test`, and `prod`, you need to answer a very practical question:

```text
Which cluster should receive which namespace, app, policy, and controller?
```

<!-- more -->

In the earlier posts, I used a small Flux demo repository to explain [the basic GitOps loop](/2026/06/18/Learning-GitOps-with-Flux-k3d-and-the-Flux-CLI/) and then showed how to install [Kyverno and Capsule through Flux](/2026/06/18/Installing-Kyverno-and-Capsule-with-Flux/).

This article extends the same idea to multiple clusters.

The concrete scenario:

- `dev` for fast iteration
- `test` for validation and experiments
- `prod` for production-like workloads

The repository is still one Git repository. Each cluster runs its own Flux controllers. Each cluster watches the same fork, but each cluster reconciles a different path:

```text
clusters/dev
clusters/test
clusters/prod
```

That is the key idea.

You do not make Flux "push" to clusters from the outside. You install Flux into each cluster, and each cluster pulls the part of Git that describes its desired state.

## The Rule

The rule I like is simple:

```text
Shared things live once.
Cluster decisions live under clusters/<cluster>.
```

Shared things are reusable building blocks:

- namespace manifests
- application bases
- HelmRelease templates
- Kyverno policies
- Capsule tenants
- Gateway resources
- monitoring components

Cluster decisions are environment choices:

- `foo` exists only in `test`
- `podinfo` runs in `dev`, `test`, and `prod`
- `kyverno` runs everywhere
- experimental policies run only in `test`
- production values differ from dev values

Do not bury those decisions inside a pile of conditionals.

Make them visible in the cluster entrypoints.

## Start from the Demo Repository

Assume you forked the demo repository:

```text
https://github.com/YOUR_USER/flux
```

The original demo has one local cluster entrypoint:

```text
clusters/k3d-demo
```

For multi-cluster management, split that into cluster-specific entrypoints:

```text
clusters/
  dev/
  test/
  prod/
```

Each cluster directory becomes the top-level state for that cluster.

For example:

```text
clusters/
  dev/
    kustomization.yaml
    flux-system/
    infra.yaml
    apps.yaml
  test/
    kustomization.yaml
    flux-system/
    infra.yaml
    apps.yaml
  prod/
    kustomization.yaml
    flux-system/
    infra.yaml
    apps.yaml
```

Each cluster gets bootstrapped with its own path:

```shell
flux bootstrap github \
  --owner=YOUR_USER \
  --repository=flux \
  --branch=main \
  --path=clusters/dev

flux bootstrap github \
  --owner=YOUR_USER \
  --repository=flux \
  --branch=main \
  --path=clusters/test

flux bootstrap github \
  --owner=YOUR_USER \
  --repository=flux \
  --branch=main \
  --path=clusters/prod
```

You would run each command against the matching kubeconfig context.

For local learning with k3d, that could mean:

```shell
k3d cluster create dev
k3d cluster create test
k3d cluster create prod
```

Then switch context and bootstrap each one:

```shell
kubectl config use-context k3d-dev
flux bootstrap github --owner=YOUR_USER --repository=flux --branch=main --path=clusters/dev

kubectl config use-context k3d-test
flux bootstrap github --owner=YOUR_USER --repository=flux --branch=main --path=clusters/test

kubectl config use-context k3d-prod
flux bootstrap github --owner=YOUR_USER --repository=flux --branch=main --path=clusters/prod
```

Now each cluster pulls from the same fork, but each one has a different root.

That difference is what lets one repository manage many clusters cleanly.

## A Practical Repository Layout

I would structure the fork like this:

```text
.
|-- clusters/
|   |-- dev/
|   |   |-- kustomization.yaml
|   |   |-- infra.yaml
|   |   `-- apps.yaml
|   |-- test/
|   |   |-- kustomization.yaml
|   |   |-- infra.yaml
|   |   `-- apps.yaml
|   `-- prod/
|       |-- kustomization.yaml
|       |-- infra.yaml
|       `-- apps.yaml
|-- infrastructure/
|   |-- controllers/
|   |   |-- kyverno/
|   |   `-- gateway-api/
|   |-- namespaces/
|   |   |-- common/
|   |   |-- test-only/
|   |   `-- team-x/
|   `-- policies/
|       `-- kyverno/
`-- apps/
    |-- common/
    |-- podinfo/
    |   |-- base/
    |   `-- overlays/
    |       |-- dev/
    |       |-- test/
    |       `-- prod/
    `-- foo-app/
        `-- base/
```

The cluster directories contain decisions.

The `infrastructure` and `apps` directories contain reusable definitions.

This keeps review sane. When a pull request adds `foo-app` to `clusters/test/apps.yaml`, you can immediately see that it only affects test. When another pull request adds `podinfo` to all three cluster app lists, you can see that too.

## The Cluster Entry Point

Each cluster gets a small `kustomization.yaml`.

For `clusters/dev/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ./flux-system
  - ./infra.yaml
  - ./apps.yaml
```

Same for `test` and `prod`.

The `flux-system` entry is important. `flux bootstrap` creates that directory with the Flux controller manifests and the sync object for the cluster. Keep it in the cluster entrypoint so Flux itself remains part of the declared state.

The `infra.yaml` and `apps.yaml` files are Flux `Kustomization` objects, not Kustomize files. The naming is unfortunately confusing, but the distinction matters.

For `clusters/dev/infra.yaml`:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: infra
  namespace: flux-system
spec:
  interval: 5m
  prune: true
  wait: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./clusters/dev/infra
```

For `clusters/dev/apps.yaml`:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: apps
  namespace: flux-system
spec:
  interval: 5m
  prune: true
  wait: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./clusters/dev/apps
  dependsOn:
    - name: infra
```

This creates a clear order:

```text
infrastructure first
apps second
```

That is usually what you want. Namespaces, CRDs, controllers, policies, and gateways should be ready before applications are reconciled.

## Cluster-Specific App Lists

Now create app lists per cluster.

```text
clusters/
  dev/
    apps/
      kustomization.yaml
  test/
    apps/
      kustomization.yaml
  prod/
    apps/
      kustomization.yaml
```

For `clusters/dev/apps/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/dev
```

For `clusters/test/apps/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/test
  - ../../../apps/foo-app/base
```

For `clusters/prod/apps/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/prod
```

That already models one important case:

```text
baseline apps from apps/common -> dev, test, prod
podinfo -> dev, test, prod
foo-app -> test only
```

There is no magic.

The app exists in the cluster if the cluster's app list references it.

The app does not exist in the cluster if the cluster's app list does not reference it.

That is the simplest and most reviewable model.

## What Is a Baseline App?

The same `common` idea can apply to apps, but it needs a stricter definition than it does for namespaces.

A baseline app is a platform component that should run in every cluster by default because the cluster is not considered complete without it.

Good examples:

- monitoring agents
- log collectors
- external-secrets
- policy reporters
- trust-manager
- ingress or gateway controllers, if every cluster uses the same one
- small internal platform agents required for compliance or operations

Bad examples:

- business applications
- feature services
- temporary migration jobs
- experimental controllers
- test workloads
- anything that should be promoted gradually

The rule is:

```text
apps/common is for platform baseline apps, not for "apps I happen to deploy often".
```

That distinction matters because adding something to `apps/common` deploys it to every cluster that imports `apps/common`. That can be exactly what you want for a log collector. It is usually not what you want for a product service.

The clean pattern looks like this:

```text
apps/common/
  kustomization.yaml
  external-secrets/
  policy-reporter/
```

And each cluster imports it explicitly:

```yaml
# clusters/dev/apps/kustomization.yaml
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/dev
```

```yaml
# clusters/test/apps/kustomization.yaml
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/test
  - ../../../apps/foo-app/base
```

```yaml
# clusters/prod/apps/kustomization.yaml
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/prod
```

So the definition stays central, but the cluster still visibly opts into the baseline app set.

This is the same principle as namespaces:

```text
Definition central.
Inclusion explicit per cluster.
```

Flux itself does not require the directory to be called `common`. The [Flux repository-structure guidance](https://fluxcd.io/flux/guides/repository-structure/) recommends shared `apps` and `infrastructure` areas plus cluster-specific entrypoints under `clusters/<environment>`. `common` is just a practical name for the subset of shared resources every cluster intentionally imports.

## Cluster-Specific Namespace Lists

Do the same thing for namespaces.

```text
clusters/
  dev/
    infra/
      kustomization.yaml
  test/
    infra/
      kustomization.yaml
  prod/
    infra/
      kustomization.yaml
```

The cleanest pattern for namespaces is usually:

```text
infrastructure/namespaces/common
infrastructure/namespaces/test-only
infrastructure/namespaces/prod-only
infrastructure/namespaces/team-x
```

Use `common` for namespaces that should exist in every cluster, for example:

- `cert-manager`
- `kyverno`
- `monitoring`
- `ingress-system`

But still import `common` explicitly from every cluster. The namespace definitions are central, but the cluster membership stays visible.

For `clusters/dev/infra/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../infrastructure/controllers/kyverno
  - ../../../infrastructure/namespaces/common
  - ../../../infrastructure/namespaces/team-x
```

For `clusters/test/infra/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../infrastructure/controllers/kyverno
  - ../../../infrastructure/namespaces/common
  - ../../../infrastructure/namespaces/team-x
  - ../../../infrastructure/namespaces/test-only
```

For `clusters/prod/infra/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../infrastructure/controllers/kyverno
  - ../../../infrastructure/namespaces/common
  - ../../../infrastructure/namespaces/team-x
```

This models another common case:

```text
namespace cert-manager -> dev, test, prod through common
namespace kyverno      -> dev, test, prod through common
namespace team-x -> dev, test, prod
namespace foo    -> test only
```

Again, the important part is visibility.

If someone asks "why does `foo` exist only in test?", the answer is in one file:

```text
clusters/test/infra/kustomization.yaml
```

And if someone asks "where is `team-x` deployed?", ripgrep tells you:

```shell
rg "infrastructure/namespaces/team-x" clusters
```

For common namespaces, the same rule applies:

```shell
rg "infrastructure/namespaces/common" clusters
```

That should show `dev`, `test`, and `prod`. If it does not, the namespace set is not actually common across all clusters.

## Common Is Good, Implicit Global Is Not

I do recommend `common` namespace sets.

What I do not recommend is an invisible global layer that is applied to every cluster without being referenced in the cluster tree.

This is good:

```yaml
# clusters/prod/infra/kustomization.yaml
resources:
  - ../../../infrastructure/namespaces/common
```

This keeps the definition central and the inclusion explicit.

This is the pattern:

```text
Definition central.
Inclusion explicit per cluster.
```

That means a shared namespace such as `kyverno` lives in one place:

```text
infrastructure/namespaces/common/ns-kyverno.yaml
```

But every cluster that should have it still imports the set:

```text
clusters/dev/infra/kustomization.yaml
clusters/test/infra/kustomization.yaml
clusters/prod/infra/kustomization.yaml
```

This small repetition is useful. It lets a reviewer see which cluster receives the shared set. It also lets you deliberately exclude a cluster if you ever need to.

## Namespace Definitions

The namespace definitions themselves should be boring.

For `infrastructure/namespaces/common/ns-kyverno.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: kyverno
  labels:
    app.kubernetes.io/part-of: platform
    platform.example.com/namespace-set: common
```

For `infrastructure/namespaces/common/ns-monitoring.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
  labels:
    app.kubernetes.io/part-of: platform
    platform.example.com/namespace-set: common
```

The common directory then has a normal `kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ns-kyverno.yaml
  - ns-monitoring.yaml
```

For `infrastructure/namespaces/team-x/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: team-x
  labels:
    app.kubernetes.io/part-of: platform
    platform.example.com/environment-scope: shared
```

For `infrastructure/namespaces/test-only/ns-foo.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: foo
  labels:
    app.kubernetes.io/part-of: platform
    platform.example.com/environment-scope: test-only
```

And `infrastructure/namespaces/test-only/kustomization.yaml` includes it:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ns-foo.yaml
```

Could you put all namespaces in one file and patch them per cluster?

Yes.

But for learning and small platform repositories, one namespace directory per logical namespace is easier to reason about. It keeps inclusion explicit.

## App Example: podinfo Everywhere

For an example app, I like `podinfo`. It is small, boring, and made for Kubernetes demos.

Create a base:

```text
apps/podinfo/base/
  deployment.yaml
  service.yaml
  kustomization.yaml
```

`apps/podinfo/base/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: podinfo
  namespace: team-x
spec:
  replicas: 1
  selector:
    matchLabels:
      app: podinfo
  template:
    metadata:
      labels:
        app: podinfo
    spec:
      containers:
        - name: podinfo
          image: ghcr.io/stefanprodan/podinfo:6.9.0
          ports:
            - containerPort: 9898
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 128Mi
```

`apps/podinfo/base/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: podinfo
  namespace: team-x
spec:
  selector:
    app: podinfo
  ports:
    - name: http
      port: 80
      targetPort: 9898
```

`apps/podinfo/base/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
```

Now create overlays.

`apps/podinfo/overlays/dev/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
patches:
  - target:
      kind: Deployment
      name: podinfo
    patch: |-
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: podinfo
      spec:
        replicas: 1
```

`apps/podinfo/overlays/test/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
patches:
  - target:
      kind: Deployment
      name: podinfo
    patch: |-
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: podinfo
      spec:
        replicas: 2
```

`apps/podinfo/overlays/prod/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
patches:
  - target:
      kind: Deployment
      name: podinfo
    patch: |-
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: podinfo
      spec:
        replicas: 3
```

Now you have one app deployed everywhere, but with environment-specific behavior:

```text
dev  -> podinfo replicas=1
test -> podinfo replicas=2
prod -> podinfo replicas=3
```

That is a good use of overlays.

The app exists in all three clusters because all three app lists include it.

The app differs per cluster because each cluster references a different overlay.

## App Example: foo Only in Test

Now create a test-only app.

```text
apps/foo-app/base/
  deployment.yaml
  service.yaml
  kustomization.yaml
```

`apps/foo-app/base/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: foo-app
  namespace: foo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: foo-app
  template:
    metadata:
      labels:
        app: foo-app
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 25m
              memory: 32Mi
            limits:
              memory: 64Mi
```

`apps/foo-app/base/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: foo-app
  namespace: foo
spec:
  selector:
    app: foo-app
  ports:
    - name: http
      port: 80
      targetPort: 80
```

`apps/foo-app/base/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
```

Only reference it in:

```text
clusters/test/apps/kustomization.yaml
```

Do not reference it in:

```text
clusters/dev/apps/kustomization.yaml
clusters/prod/apps/kustomization.yaml
```

That is the cleanest way to say:

```text
foo-app belongs only in test.
```

If someone accidentally adds `foo-app` to prod, the pull request diff will show exactly that.

## What About Kyverno?

Kyverno is a good example of a platform component that usually belongs everywhere.

The component itself should be shared:

```text
infrastructure/controllers/kyverno/
  helmrepository.yaml
  helmrelease.yaml
  kustomization.yaml
```

Then each cluster includes it:

```yaml
resources:
  - ../../../infrastructure/controllers/kyverno
```

Policies are different.

Some policies should run everywhere:

```text
require-pod-resources
disallow-privileged-containers
restrict-host-path
```

Some policies should start in test:

```text
require-signed-images
deny-latest-tag
restrict-ingress-hostnames
```

For that, split policies by rollout stage:

```text
infrastructure/policies/kyverno/
  shared/
  test-only/
  prod/
```

Then include them per cluster.

`clusters/dev/infra/kustomization.yaml`:

```yaml
resources:
  - ../../../infrastructure/controllers/kyverno
  - ../../../infrastructure/namespaces/common
  - ../../../infrastructure/policies/kyverno/shared
  - ../../../infrastructure/namespaces/team-x
```

`clusters/test/infra/kustomization.yaml`:

```yaml
resources:
  - ../../../infrastructure/controllers/kyverno
  - ../../../infrastructure/namespaces/common
  - ../../../infrastructure/policies/kyverno/shared
  - ../../../infrastructure/policies/kyverno/test-only
  - ../../../infrastructure/namespaces/team-x
  - ../../../infrastructure/namespaces/test-only
```

`clusters/prod/infra/kustomization.yaml`:

```yaml
resources:
  - ../../../infrastructure/controllers/kyverno
  - ../../../infrastructure/namespaces/common
  - ../../../infrastructure/policies/kyverno/shared
  - ../../../infrastructure/policies/kyverno/prod
  - ../../../infrastructure/namespaces/team-x
```

That gives you a sane policy promotion flow:

```text
write policy in test-only as Audit
  -> observe reports in test
  -> move policy to shared or prod when stable
  -> switch Audit to Enforce when ready
```

This is better than toggling one giant policy file with comments like:

```text
# TODO enable in prod later
```

Git structure should make rollout intent visible.

## The Two Most Common Patterns

There are really only two patterns you need most of the time.

### Pattern 1: Shared Base, Cluster Overlays

Use this when the thing exists in multiple clusters but has different values.

Example:

```text
apps/podinfo/base
apps/podinfo/overlays/dev
apps/podinfo/overlays/test
apps/podinfo/overlays/prod
```

Good for:

- replica count
- resource requests
- image tags
- environment variables
- hostnames
- feature flags
- Helm values

### Pattern 2: Cluster App Lists

Use this when the thing should exist only in some clusters.

Example:

```text
clusters/test/apps/kustomization.yaml
```

references:

```text
../../../apps/foo-app/base
```

but dev and prod do not.

Good for:

- temporary apps
- test-only namespaces
- staging validation workloads
- experimental controllers
- policies being trialed
- migration helpers

The mistake is using overlays for presence.

If an app should not exist in prod, do not create a prod overlay that disables everything. Just do not reference the app from prod.

Absence should be represented by absence.

## Promotion Workflow

Assume `foo-app` starts as test-only.

Initial state:

```text
clusters/dev/apps/kustomization.yaml   -> no foo-app
clusters/test/apps/kustomization.yaml  -> foo-app
clusters/prod/apps/kustomization.yaml  -> no foo-app
```

Promotion to dev and prod is a normal pull request.

First add it to dev:

```yaml
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/dev
  - ../../../apps/foo-app/base
```

Then later add it to prod:

```yaml
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/prod
  - ../../../apps/foo-app/base
```

If prod needs different values, create an overlay before adding it:

```text
apps/foo-app/overlays/prod
```

Then reference that instead:

```yaml
resources:
  - ../../../apps/foo-app/overlays/prod
```

The pull request tells the story:

```text
foo-app is moving from test-only to prod.
```

That is exactly what you want from GitOps. Operational intent should be reviewable.

## Example: Move a Test App to All Clusters

Here is the same app promotion as a concrete checklist.

Assume `foo-app` currently exists only in test:

```yaml
# clusters/test/apps/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/test
  - ../../../apps/foo-app/base
```

And dev/prod do not reference it:

```yaml
# clusters/dev/apps/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/dev
```

```yaml
# clusters/prod/apps/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/prod
```

If `foo-app` should now run in all three clusters, first decide whether it is a baseline app.

If it is not a baseline app, the smallest clean change is to add it to the dev and prod app lists:

```yaml
# clusters/dev/apps/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/dev
  - ../../../apps/foo-app/base
```

```yaml
# clusters/prod/apps/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/prod
  - ../../../apps/foo-app/base
```

That is enough if the exact same manifests are valid for dev, test, and prod, but it still keeps the rollout visible in the cluster lists.

If `foo-app` really is a baseline app, move it into `apps/common` instead:

```yaml
# apps/common/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../foo-app/base
```

Then remove the direct test-only reference:

```yaml
# clusters/test/apps/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../apps/common
  - ../../../apps/podinfo/overlays/test
```

That change means every cluster importing `apps/common` receives `foo-app`. This is clean only if `foo-app` meets the baseline definition. Otherwise, prefer explicit per-cluster references.

If prod needs different settings, do not patch prod from the cluster list. Create a prod overlay:

```text
apps/foo-app/
  base/
  overlays/
    dev/
    test/
    prod/
```

Then point each cluster at the right overlay:

```yaml
# clusters/dev/apps/kustomization.yaml
resources:
  - ../../../apps/foo-app/overlays/dev
```

```yaml
# clusters/test/apps/kustomization.yaml
resources:
  - ../../../apps/foo-app/overlays/test
```

```yaml
# clusters/prod/apps/kustomization.yaml
resources:
  - ../../../apps/foo-app/overlays/prod
```

This is the better long-term model when environments differ. The cluster app list decides presence. The app overlay decides configuration.

## Example: Move a Test Namespace to All Clusters

Namespaces follow the same rule.

Assume `foo` currently exists only in test:

```yaml
# clusters/test/infra/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../infrastructure/controllers/kyverno
  - ../../../infrastructure/namespaces/common
  - ../../../infrastructure/namespaces/team-x
  - ../../../infrastructure/namespaces/test-only
```

Dev and prod have `common` and `team-x`, but not the test-only set:

```yaml
# clusters/dev/infra/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../infrastructure/controllers/kyverno
  - ../../../infrastructure/namespaces/common
  - ../../../infrastructure/namespaces/team-x
```

```yaml
# clusters/prod/infra/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../infrastructure/controllers/kyverno
  - ../../../infrastructure/namespaces/common
  - ../../../infrastructure/namespaces/team-x
```

To make `foo` exist in all three clusters, first decide whether it is a common namespace.

If `foo` is now a platform namespace that should always exist, move it from `test-only` into `common`:

```yaml
# infrastructure/namespaces/common/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ns-kyverno.yaml
  - ns-monitoring.yaml
  - ns-foo.yaml
```

And remove it from the test-only set. Before:

```yaml
# infrastructure/namespaces/test-only/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ns-foo.yaml
```

After removing `ns-foo.yaml`, if nothing else remains in `test-only`, delete the `test-only` directory and remove this import from `clusters/test/infra/kustomization.yaml`:

```yaml
- ../../../infrastructure/namespaces/test-only
```

Because dev, test, and prod already import `infrastructure/namespaces/common`, all three clusters receive `foo`. The PR should make that blast radius obvious because it changes the common namespace set.

If `foo` is not truly common, do not put it in `common`. Add it explicitly to the clusters that need it, or create a named set such as:

```text
infrastructure/namespaces/customer-facing
infrastructure/namespaces/internal-tools
```

Then import that set from the relevant cluster trees.

If the namespace metadata differs by environment, use overlays:

```text
infrastructure/namespaces/foo/
  base/
  overlays/
    dev/
    test/
    prod/
```

Then point each cluster at its overlay:

```yaml
# clusters/dev/infra/kustomization.yaml
resources:
  - ../../../infrastructure/namespaces/foo/overlays/dev
```

```yaml
# clusters/test/infra/kustomization.yaml
resources:
  - ../../../infrastructure/namespaces/foo/overlays/test
```

```yaml
# clusters/prod/infra/kustomization.yaml
resources:
  - ../../../infrastructure/namespaces/foo/overlays/prod
```

For most namespaces, I would keep the metadata identical and avoid overlays. A namespace usually should not need much environment-specific behavior. But if labels, quotas, network defaults, or annotations differ, overlays are the right place to express that.

## What Changes in Git?

For both cases, the best workflow is a small pull request.

For moving `foo-app` from test-only to all clusters, the PR touches:

```text
clusters/dev/apps/kustomization.yaml
clusters/prod/apps/kustomization.yaml
```

Maybe it also adds:

```text
apps/foo-app/overlays/dev
apps/foo-app/overlays/prod
```

For moving namespace `foo` from test-only to all clusters, the PR touches:

```text
infrastructure/namespaces/common/kustomization.yaml
infrastructure/namespaces/test-only/kustomization.yaml
```

Maybe it also moves:

```text
infrastructure/namespaces/test-only/ns-foo.yaml
infrastructure/namespaces/common/ns-foo.yaml
```

If `foo` should not be a common namespace, the PR instead touches the specific cluster infra lists that should import it. That keeps the blast radius obvious. The PR does not hide a production rollout inside an unrelated shared base file.

That is the answer I would give in code review:

```text
If the thing should now exist in another cluster, add it to that cluster's list.
If the thing is truly baseline/common, add it to the common set imported by those clusters.
If the thing needs different settings there, add an overlay and reference that overlay.
```

## Bootstrap Paths Matter

Each cluster should be bootstrapped with its own path.

That path is the root of truth for that cluster.

For example, on `dev`:

```shell
flux get sources git -A
flux get kustomizations -A
```

The `flux-system` GitRepository should point to your fork and branch. The top-level Flux Kustomization should point to:

```text
./clusters/dev
```

On `test`, it should point to:

```text
./clusters/test
```

On `prod`, it should point to:

```text
./clusters/prod
```

If all three clusters accidentally point at `./clusters/dev`, they will all become dev. Flux is very good at doing exactly what you told it to do.

That is why I like making the cluster name visible in the path and in the bootstrap command.

## Local k3d Practice

You can practice this locally with three k3d clusters.

Create them:

```shell
k3d cluster create dev
k3d cluster create test
k3d cluster create prod
```

Bootstrap `dev`:

```shell
kubectl config use-context k3d-dev
flux bootstrap github \
  --owner=YOUR_USER \
  --repository=flux \
  --branch=main \
  --path=clusters/dev
```

Bootstrap `test`:

```shell
kubectl config use-context k3d-test
flux bootstrap github \
  --owner=YOUR_USER \
  --repository=flux \
  --branch=main \
  --path=clusters/test
```

Bootstrap `prod`:

```shell
kubectl config use-context k3d-prod
flux bootstrap github \
  --owner=YOUR_USER \
  --repository=flux \
  --branch=main \
  --path=clusters/prod
```

Then inspect each cluster:

```shell
kubectl config use-context k3d-dev
kubectl get ns
kubectl -n team-x get deploy

kubectl config use-context k3d-test
kubectl get ns
kubectl -n foo get deploy

kubectl config use-context k3d-prod
kubectl get ns
kubectl -n team-x get deploy
```

Expected result:

```text
dev:
  namespace team-x exists
  namespace foo does not exist
  podinfo exists

test:
  namespace team-x exists
  namespace foo exists
  podinfo exists
  foo-app exists

prod:
  namespace team-x exists
  namespace foo does not exist
  podinfo exists
```

That is the whole point of the structure.

The desired state is not hidden in cluster memory. It is visible in Git.

## Validation Before Merge

A multi-cluster repository needs validation.

At minimum, validate every cluster entrypoint:

```shell
kustomize build clusters/dev
kustomize build clusters/test
kustomize build clusters/prod
```

If your validation script already searches every `kustomization.yaml`, keep that. But also make the three cluster entrypoints explicit in CI, because those are the real deliverables.

I would also validate rendered manifests with `kubeconform`:

```shell
for cluster in dev test prod; do
  kustomize build "clusters/${cluster}" \
    | kubeconform -strict -ignore-missing-schemas
done
```

For Flux objects, include the Flux CRD schemas in your validation script, just like in the demo repository.

The goal is simple:

```text
Do not let broken YAML become desired state for three clusters.
```

## Operational Rules I Would Follow

I would keep a few rules:

- Every cluster has exactly one entrypoint under `clusters/<name>`.
- Shared app and infrastructure definitions live outside `clusters`.
- A cluster gets a resource only by referencing it from its cluster tree.
- Use overlays for differences, not for presence.
- Use pull requests to promote resources between clusters.
- Keep `prod` boring and explicit.
- Validate all cluster entrypoints in CI.

The most important one is this:

```text
Do not make cluster membership implicit.
```

If `foo-app` runs in test only, I want to see it in `clusters/test/apps/kustomization.yaml`.

If `team-x` exists everywhere, I want to see it referenced by dev, test, and prod.

If Kyverno is installed everywhere, I want all three clusters to include the Kyverno controller path.

That repetition is not bad duplication. It is operational clarity.

## Final Thoughts

Flux does not need a special "multi-cluster mode" for this.

Each cluster runs Flux.

Each cluster watches the same repository.

Each cluster reconciles its own path.

That gives you a clean model:

```text
shared definitions
  + cluster-specific entrypoints
  + Kustomize overlays
  + Flux reconciliation
```

For three clusters, this is usually enough.

Start with explicit cluster app lists. Add overlays only when the same app needs different configuration per cluster. Keep namespaces and platform controllers visible in cluster infra lists. Use Kyverno or another platform component as a shared building block, but roll policies forward deliberately.

The structure should let you answer the most important question in seconds:

```text
What is supposed to run where?
```

If the repository can answer that clearly, Flux can do the rest.
