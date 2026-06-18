---
title: "Learning GitOps with Flux, k3d, and the Flux CLI"
description: "A practical walkthrough of a local Flux GitOps demo using k3d, Gateway API, and the Flux CLI."
layout: post
date: 2026-06-18 10:00:00 +0200
tags: [Kubernetes, GitOps, Flux]
---

GitOps is one of those ideas that sounds more complicated than it has to be.

The useful version is simple: Git becomes the desired state for your cluster, and a controller inside Kubernetes keeps the real cluster aligned with that desired state.

That is what Flux does.

<!-- more -->

It watches sources such as Git repositories, OCI artifacts, and Helm charts. It renders and applies Kubernetes manifests from those sources. It notices when Git changes. It notices when the cluster drifts. Then it reconciles the cluster back toward the declared state.

This is different from a CI pipeline that runs `kubectl apply` once and then disappears.

With Flux, the deployment mechanism lives inside the cluster. The cluster keeps asking a boring but important question:

```text
Does the live state still match what Git says?
```

If the answer is no, Flux tries to fix it.

That operating model is the reason Flux is useful. You do not have to trust that every human, script, and pipeline remembered to apply the right YAML in the right order. You put the state in Git, review changes like normal code, and let controllers continuously reconcile it.

## The Demo Repository

I created a small repository for learning this locally:

```text
https://github.com/dme86/flux
```

The goal is not to build a production platform. The goal is to have a compact Flux playground that you can run on your own machine with k3d.

The repository contains:

- Flux bootstrap manifests
- a local k3d cluster workflow
- infrastructure Kustomizations
- an Envoy Gateway installation through Flux
- a simple `hello-world` application
- an HTTPRoute that exposes the app through Gateway API
- validation for manifests in GitHub Actions and locally

The layout looks roughly like this:

```text
clusters/
  k3d-demo/
    flux-system/
    infra/
    apps/
infra/
  gateway-api/
  namespaces/
  notifications/
apps/
  hello-world-gateway/
scripts/
  validate.sh
Makefile
.tool-versions
```

The important directory is `clusters/k3d-demo`. That is the cluster entrypoint. It wires together Flux itself, cluster-level infrastructure, and application-level resources.

The split is intentional:

- `clusters/k3d-demo/flux-system` defines Flux components and external sources
- `clusters/k3d-demo/infra` defines cluster infrastructure reconciliation
- `clusters/k3d-demo/apps` defines application reconciliation
- `infra/*` contains reusable infrastructure manifests
- `apps/*` contains application-specific manifests

This is a small version of the structure I would also use in a real platform repository. The exact folder names can change, but the separation matters. Cluster entrypoints should be easy to read. Shared infrastructure should not be mixed into application folders. Applications should be independently understandable.

## What Flux Is Actually Doing Here

Flux is made of controllers.

For this demo, the most important pieces are:

- Source Controller
- Kustomize Controller
- Helm Controller
- Notification Controller

The Source Controller fetches things. In this repository that means the Git repository itself, the upstream Kubernetes kustomize examples repository, and the Envoy Gateway Helm chart as an OCI artifact.

The Kustomize Controller reconciles `Kustomization` objects. A Flux `Kustomization` is not the same thing as a plain `kustomization.yaml` file, even though the names are confusing at first. The Flux object says: "take this path from this source, render it, apply it, prune removed resources, and do this again on an interval."

For example, the demo has a Flux Kustomization for namespaces:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: namespaces
  namespace: flux-system
spec:
  interval: 5m
  prune: true
  wait: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  path: ./infra/namespaces/base
  timeout: 2m
```

That object tells Flux to apply the manifests from `./infra/namespaces/base` in the repository. If a namespace is removed from Git later, `prune: true` lets Flux remove it from the cluster too.

The Helm Controller reconciles Helm releases. In this demo it installs Envoy Gateway from an OCI-backed chart source:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata:
  name: envoy-gateway
  namespace: flux-system
spec:
  interval: 1h
  url: oci://docker.io/envoyproxy/gateway-helm
  ref:
    semver: ">=1.7.0 <2.0.0"
```

Then a `HelmRelease` consumes that source:

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: envoy-gateway
  namespace: envoy-gateway-system
spec:
  interval: 5m
  install:
    createNamespace: true
  chartRef:
    kind: OCIRepository
    name: envoy-gateway
    namespace: flux-system
```

The Notification Controller is used for GitHub commit status integration. It is not required for the local demo, but it is a useful piece to include because notifications are part of the real GitOps feedback loop.

If you want that notification Kustomization to become fully healthy, create the expected GitHub token secret:

```shell
export GITHUB_TOKEN=ghp_replace_this_with_your_token
kubectl -n flux-system create secret generic github-token \
  --from-literal=token="$GITHUB_TOKEN"
```

The application path does not depend on notifications, so you can still use the demo to learn Flux, k3d, Gateway API, and reconciliation without wiring up commit statuses first.

## Reconciliation Order

One thing I like about this demo is that it shows dependency ordering without hiding it.

The cluster needs namespaces before namespace-scoped resources can be applied. The app route needs the Gateway and the app to exist before it can work. Flux models this through `dependsOn`.

The rough order is:

```text
sources
  -> namespaces
      -> gateway
      -> notifications
      -> hello-world
          -> hello-world-route
```

The `hello-world` app depends on `namespaces`:

```yaml
spec:
  dependsOn:
    - name: namespaces
```

The route depends on both the Gateway and the app:

```yaml
spec:
  dependsOn:
    - name: gateway
    - name: hello-world
```

This is a good detail to learn early.

GitOps is not just throwing YAML into a repository. Once the repository grows, order matters. Some things are prerequisites. Some things can be reconciled independently. Some things should not run until another controller has finished creating CRDs, namespaces, or services.

Flux gives you a way to express that directly in the cluster state.

## Running the Demo Locally

The repository is designed for macOS with `asdf`, Colima, Docker CLI, and k3d.

The pinned tools are in `.tool-versions`:

```text
flux 2.7.5
k3d 5.8.3
colima 0.10.0
helm 4.1.1
kubectl 1.35.1
docker system
lima 2.0.3
```

From a fresh checkout, install the tools and create a basic development cluster:

```shell
make tools
make cluster-up
```

That starts Colima with the Docker runtime, switches Docker to the Colima context, creates a k3d cluster, disables Traefik, and selects the `kubectl` context.

For the full Flux demo, use:

```shell
make demo-up
```

This does four important things:

1. Creates a k3d cluster named `demo`
2. Maps `localhost:8080` on your machine to port `80` on the k3d load balancer
3. Installs Flux controllers into the cluster
4. Creates Flux sources and Kustomizations for this repository

Once it finishes, check the Flux state:

```shell
make status
```

That runs:

```shell
flux get sources git -A
flux get sources oci -A
flux get kustomizations -A
```

If everything is healthy, you should see the Git sources, OCI source, and Kustomizations become ready.

By default the demo watches:

```text
https://github.com/dme86/flux
```

on the `main` branch. If you want to edit the manifests yourself, point the demo at your own fork or branch:

```shell
make demo-up REPO_URL=https://github.com/YOUR_USER/flux REPO_BRANCH=YOUR_BRANCH
```

Then test the app:

```shell
curl -i http://localhost:8080/
```

The request enters the k3d load balancer, reaches Envoy Gateway, follows the `HTTPRoute`, and ends up at the `hello-world` service.

For a local learning setup, that is a nice amount of machinery:

- local Kubernetes through k3d
- GitOps reconciliation through Flux
- Helm chart reconciliation through Flux
- Gateway API routing
- an application source outside the platform repo
- local access through a mapped port

It is small enough to understand, but real enough to teach the right concepts.

## Using the Flux CLI

The Flux CLI is not only for installation. It is also how you inspect, debug, and manually trigger reconciliation.

Start with:

```shell
flux check
```

For a fresh machine before installation, you can run:

```shell
flux check --pre
```

After installation, inspect the controllers:

```shell
kubectl -n flux-system get pods
flux check
```

Then look at sources:

```shell
flux get sources git -A
flux get sources oci -A
```

And Kustomizations:

```shell
flux get kustomizations -A
```

This is the first debugging habit to build. Do not start by randomly describing pods. Ask Flux what it thinks the source and reconciliation state are.

If something is stuck, logs are useful:

```shell
flux logs --all-namespaces --follow
```

For a narrower view:

```shell
flux logs \
  --namespace flux-system \
  --kind Kustomization \
  --name gateway
```

The CLI also lets you trigger reconciliation immediately instead of waiting for the next interval:

```shell
flux reconcile source git flux-system -n flux-system
flux reconcile kustomization platform-infra -n flux-system
```

The `platform-*` Kustomizations are the top-level objects created by the Makefile. The repository also creates child Kustomizations such as `namespaces`, `gateway`, `hello-world`, and `hello-world-route`. When you want to force a specific app or infrastructure object to apply its path immediately, reconcile the child Kustomization directly:

```shell
flux reconcile kustomization hello-world-route -n flux-system
```

The Makefile also has a broader top-level helper:

```shell
make reconcile
```

That reconciles the top-level `platform-*` objects. For specific app or infra paths, use the direct child Kustomization command as shown above. Both patterns are useful while learning because you can make a change, force reconciliation, and watch the result right away.

## Example 1: Learn Reconciliation by Changing a Route

A simple exercise is to change the HTTP route path.

Start the demo:

```shell
make demo-up
```

Confirm that the root path works:

```shell
curl -i http://localhost:8080/
```

Now change `apps/hello-world-gateway/httproute.yaml` from:

```yaml
matches:
  - path:
      type: PathPrefix
      value: /
```

to something more specific:

```yaml
matches:
  - path:
      type: PathPrefix
      value: /hello
```

Commit and push that change to the branch Flux is watching.

Then force Flux to pick it up:

```shell
flux reconcile source git flux-system -n flux-system
flux reconcile kustomization hello-world-route -n flux-system
```

Check the route:

```shell
kubectl -n hello-world get httproute hello-world -o yaml
```

Now test both paths:

```shell
curl -i http://localhost:8080/
curl -i http://localhost:8080/hello
```

This teaches the core loop:

```text
change Git
  -> Flux fetches the new revision
  -> Flux reconciles the Kustomization
  -> Kubernetes state changes
  -> traffic behavior changes
```

That is the loop you want to understand before adding more tools.

## Example 2: Learn Drift Correction

The second exercise is more important.

GitOps is not only about deploying changes. It is also about correcting drift.

After the demo is running, manually edit the live HTTPRoute:

```shell
kubectl -n hello-world patch httproute hello-world \
  --type merge \
  -p '{"spec":{"rules":[{"matches":[{"path":{"type":"PathPrefix","value":"/manual"}}],"backendRefs":[{"name":"the-service","port":8666}]}]}}'
```

Now inspect it:

```shell
kubectl -n hello-world get httproute hello-world -o yaml
```

The live cluster has drifted away from Git.

Trigger Flux:

```shell
flux reconcile kustomization hello-world-route -n flux-system
```

Inspect the route again:

```shell
kubectl -n hello-world get httproute hello-world -o yaml
```

Flux should move it back to the value declared in Git.

This is the moment where GitOps usually clicks. Flux is not just a deployment button. It is a controller that continuously defends the desired state.

That does not mean nobody can ever make an emergency manual change. It means manual changes are treated as temporary drift, not as the new source of truth.

## Example 3: Create a Temporary Learning Kustomization

Another useful Flux CLI exercise is to create a small Kustomization from the CLI and export it before applying it.

The demo Makefile already does this pattern:

```shell
flux create kustomization platform-apps \
  --source=GitRepository/flux-system \
  --path="./clusters/k3d-demo/apps" \
  --interval=5m \
  --prune=true \
  --wait=true \
  --depends-on=platform-infra \
  --export | kubectl apply -f -
```

The important flag is `--export`.

Without it, the CLI talks to the cluster and creates the resource directly. With `--export`, it prints the Kubernetes YAML. That makes the command useful for learning because you can see exactly what object Flux needs.

Try this with a throwaway path:

```shell
flux create kustomization learning-example \
  --source=GitRepository/flux-system \
  --path="./apps/hello-world-gateway" \
  --interval=1m \
  --prune=true \
  --wait=true \
  --export
```

Do not apply it yet. Read the output first.

You should see a normal Kubernetes object:

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: learning-example
  namespace: flux-system
spec:
  interval: 1m
  path: ./apps/hello-world-gateway
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system
  wait: true
```

That is the useful mental model: the Flux CLI is often a YAML generator and inspector. The real desired state should still end up in Git.

For production workflows, I would usually commit the generated object instead of relying on an imperative CLI command. For learning, `--export | kubectl apply -f -` is convenient because it lets you experiment quickly.

## Validation Before Reconciliation

The repository also includes validation because GitOps without validation can become very noisy.

The local script runs:

- YAML syntax validation with `yq`
- Kubernetes schema validation with `kubeconform`
- Flux CRD schema validation
- `kustomize build` validation for every `kustomization.yaml`

Run it before pushing:

```shell
./scripts/validate.sh
```

The GitHub Actions workflow runs the same script for pull requests and pushes to `main`.

This matters because Flux will faithfully try to reconcile what you put in Git. If the manifests are broken, the cluster will tell you, but that is late feedback. A pull request check gives you earlier feedback and keeps the GitOps loop calmer.

## What This Demo Teaches

This repository teaches a few useful habits:

- keep cluster entrypoints small and readable
- separate sources, infrastructure, and apps
- model dependencies explicitly with `dependsOn`
- use `prune: true` so deleted Git resources are removed from the cluster
- use `wait: true` when dependent resources should not race ahead
- inspect Flux state with `flux get` before debugging random pods
- use `flux reconcile` to shorten the feedback loop while learning
- validate manifests before pushing them into the reconciliation path

It also teaches a more subtle lesson: GitOps is mostly about removing ambiguity.

The source of truth is Git.

The reconciliation engine is Flux.

The local cluster is disposable.

The workflow becomes:

```text
edit
validate
commit
push
reconcile
observe
```

That is a much better learning loop than building a giant cluster and trying to understand every moving part at once.

## Cleaning Up

When you are done, remove the demo cluster:

```shell
make demo-down
```

If you used the more generic development cluster target, remove that cluster with:

```shell
make cluster-down
```

And if you want to stop Colima:

```shell
make colima-down
```

## Final Thoughts

Flux is not magic, and that is a good thing.

It is a set of Kubernetes controllers that continuously reconcile declared state from external sources. Once you understand sources, Kustomizations, HelmReleases, dependencies, pruning, and reconciliation intervals, the system becomes much less mysterious.

A local k3d cluster is a good place to learn that because the cost of breaking things is low. You can create the cluster, change Git, force reconciliation, inspect the result, break something, watch Flux complain, fix it, and delete the whole environment when you are done.

That is exactly the kind of loop you want when learning GitOps.
