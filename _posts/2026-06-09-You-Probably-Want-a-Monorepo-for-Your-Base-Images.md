---
title: "You Probably Want a Monorepo for Your Base Images"
description: "Why a monorepo is often the right model for internal base and tool images."
layout: post
date: 2026-06-09 09:00:00 +0200
tags: [Docker, CI/CD]
---

Most engineering teams do not start with an image governance problem.

They start with something humble: one `Dockerfile` for Python, one for Node.js, one for `kubectl`, maybe one for Maven or a Java runtime. Every repository looks small enough to be harmless. Then the small things start multiplying: slightly different labels, slightly different CI jobs, slightly different versioning schemes, slightly different ways to import internal certificate authorities, slightly different smoke tests, slightly different signing steps.

<!-- more -->

At some point, you no longer have “a few image repositories”. You have a distributed release system with no single place to reason about it.

This article describes a pattern I like for internal base images and tool images: a dedicated Docker images monorepo. The goal is not to put everything into one repository because monorepos are fashionable. The goal is to centralize the things that must not drift:

- image versions and release tags
- internal CA bundle handling
- OCI labels
- image family relationships
- build targets and platforms
- policy checks
- smoke tests
- signing
- supply-chain metadata

The examples below use generic values and a simplified structure, but they are based on a real-world implementation using GitLab CI, Docker Buildx Bake, ORAS, Cosign, SOPS, age, Hadolint, Conftest and pre-commit hooks.

## The Problem With “One Repo Per Image”

A multi-repo setup looks clean at first:

```text
images-alpine/
images-python/
images-node/
images-kubectl/
images-maven/
images-tomcat/
```

Each repository has one job. That sounds attractive.

The problem is that base images are rarely independent. They often share the same internal trust store, the same release policy, the same registry, the same signing requirements, the same metadata requirements and the same CI/CD structure.

Over time, the following questions become surprisingly hard to answer:

- Which images contain which internal CA bundle?
- Which images were rebuilt after the CA bundle changed?
- Are all images signed?
- Are all images labeled consistently?
- Are all CI jobs using pinned build images?
- Are any Dockerfiles still downloading external tools without checksums?
- Are mutable tags like `latest`, `stable` or `1` being published?
- Are all repositories using the same Hadolint and Conftest rules?
- Which images are multi-arch and which ones are `amd64` only?
- Which images inherit from which internal base image?

You can solve some of this with GitLab CI components, Renovate, shared templates and central policy repositories. Those are good tools. But they do not change the basic operating model: every repository still has to include the right thing, pin the right version, keep it updated, and not override the important parts.

At that point, you are building extra central machinery to keep distributed repositories from drifting apart.

For internal base and tool images, that is often the signal that the standard itself should live closer to the images.

## Repository Layout

A useful image monorepo does not need to be complicated. One possible layout looks like this:

```text
.
├── .gitlab-ci.yml
├── .pre-commit-config.yaml
├── .hadolint.yaml
├── Makefile
├── docker-bake.hcl
├── images/
│   ├── alpine/
│   │   └── Dockerfile
│   ├── kubectl/
│   │   └── Dockerfile
│   ├── node/
│   │   └── Dockerfile
│   ├── python/
│   │   └── Dockerfile
│   ├── maven/
│   │   └── Dockerfile
│   └── ...
├── policy/
│   ├── bake.rego
│   ├── dockerfiles.rego
│   └── gitlab_ci.rego
├── scripts/
│   ├── check-image-versions.sh
│   ├── verify-ca-bundle.sh
│   ├── build-arch-images.sh
│   ├── publish-images.sh
│   ├── smoke-images.sh
│   ├── sign-images.sh
│   └── lint-policies.sh
├── security/
│   ├── ca-bundle.sha256
│   ├── cosign.pub
│   └── sops-age-recipient.txt
└── secrets/
    └── cosign.key.sops
```

The important part is the separation of responsibilities.

Dockerfiles describe image contents. They should answer: what packages, files, entrypoints and runtime behavior does this image have?

`docker-bake.hcl` describes the build and release model. It should answer: which images exist, which tags do they get, which platforms are built, which labels are applied, which build arguments are used and which images depend on each other?

GitLab CI executes the release flow. It should answer: how do we verify, build, publish, smoke-test and sign the images?

Policy code enforces the rules. It should answer: what is not allowed in this repository?

## Buildx Bake as the Single Build Definition

The core of the setup is `docker-bake.hcl`. Dockerfiles alone are not enough for image governance because they do not describe the release matrix.

A Bake file can centralize variables such as registry targets, Git metadata, CA bundle metadata, image versions and release counters:

```hcl
variable "REGISTRY" {
  default = "registry.example.com/platform/images"
}

variable "IMAGE_TAG" {
  default = "dev"
}

variable "IMAGE_REVISION" {
  default = ""
}

variable "IMAGE_SOURCE" {
  default = ""
}

variable "IMAGE_CREATED" {
  default = ""
}

variable "CA_BUNDLE_REF" {
  default = ""
}

variable "CA_BUNDLE_DIGEST" {
  default = ""
}

variable "KUBECTL_VERSION" {
  default = "1.30.6"
}

variable "ALPINE_RELEASE" {
  default = "1"
}
```

Then define common labels once:

```hcl
target "_common" {
  labels = {
    "org.opencontainers.image.created"       = "${IMAGE_CREATED}"
    "org.opencontainers.image.revision"      = "${IMAGE_REVISION}"
    "org.opencontainers.image.source"        = "${IMAGE_SOURCE}"
    "org.opencontainers.image.vendor"        = "Example Corp"
    "de.example.ca-bundle.ref"               = "${CA_BUNDLE_REF}"
    "de.example.ca-bundle.digest"            = "${CA_BUNDLE_DIGEST}"
  }
}
```

Platform profiles make architecture support explicit:

```hcl
target "_multiarch" {
  platforms = ["linux/amd64", "linux/arm64"]
}

target "_amd64" {
  platforms = ["linux/amd64"]
}
```

A target can then inherit both common metadata and a platform profile:

```hcl
target "kubectl" {
  inherits = ["_common", "_multiarch"]
  context = "."
  dockerfile = "images/kubectl/Dockerfile"

  contexts = {
    alpine = "target:alpine"
  }

  tags = [
    "${REGISTRY}/kubectl:${KUBECTL_VERSION}-r${ALPINE_RELEASE}",
    "${REGISTRY}/kubectl:${KUBECTL_VERSION}",
    "${REGISTRY}/kubectl:${IMAGE_TAG}"
  ]

  args = {
    KUBECTL_VERSION = "${KUBECTL_VERSION}"
  }
}
```

The first tag is the immutable release tag. The additional tags are convenience or traceability tags.

This pattern separates two dimensions that are often accidentally mixed:

```text
Tool version:        kubectl 1.30.6
Image release:       r1, r2, r3
```

A new internal CA bundle or base image patch does not mean `kubectl` itself changed. It means the image release changed. A tag like `1.30.6-r2` communicates that clearly.

## Image Families

Base images and tool images usually form families.

For example:

```text
Alpine family:
  alpine
  alpine-toolbox
  ansible
  kubectl

Java family:
  eclipse-temurin
  maven
  tomcat
  instantclient

.NET family:
  aspnet
  dotnet-build
  syncfusion

Runtime/tool family:
  node
  python
  teamscale-upload
```

Families matter because a change to a base or trust layer may require rebuilding downstream images.

In a monorepo, this relationship can be represented directly in Bake using named build contexts:

```hcl
target "alpine" {
  inherits = ["_common", "_multiarch"]
  dockerfile = "images/alpine/Dockerfile"

  tags = [
    "${REGISTRY}/alpine:${ALPINE_IMAGE_VERSION}-r${ALPINE_RELEASE}",
    "${REGISTRY}/alpine:${ALPINE_IMAGE_VERSION}"
  ]
}

target "kubectl" {
  inherits = ["_common", "_multiarch"]
  dockerfile = "images/kubectl/Dockerfile"

  contexts = {
    alpine = "target:alpine"
  }

  tags = [
    "${REGISTRY}/kubectl:${KUBECTL_VERSION}-r${ALPINE_RELEASE}",
    "${REGISTRY}/kubectl:${KUBECTL_VERSION}"
  ]
}
```

In the Dockerfile:

```dockerfile
FROM alpine

ARG KUBECTL_VERSION

# image content here
```

Here, `FROM alpine` is not a random public image. BuildKit resolves it from the named context `alpine = "target:alpine"` during the Bake build.

That is an important distinction: the derived image can build against the freshly built internal base image in the same build graph.

## Pipeline Overview

A solid pipeline for internal images should do more than `docker build && docker push`.

A useful flow is:

```text
policy
  → preflight
  → verify
  → build
  → publish
  → smoke
  → sign
```

In GitLab CI this can look like:

```yaml
stages:
  - policy
  - preflight
  - verify
  - build
  - publish
  - smoke
  - sign
```

The responsibilities are deliberately split:

| Stage | Purpose |
|---|---|
| `policy` | Run Hadolint, Conftest and repository policy checks. |
| `preflight` | Resolve Bake targets and check whether release tags already exist. |
| `verify` | Verify internal CA bundle and external artifacts before building. |
| `build` | Build temporary per-architecture images. |
| `publish` | Create final tags and multi-arch manifest lists. |
| `smoke` | Run target-specific smoke tests against the published images. |
| `sign` | Sign final image digests with Cosign. |

This structure makes the pipeline auditable. It is clear where trust enters the build, where artifacts are created, where final tags appear and when signing happens.

## Preflight: Build Only Missing Release Tags

One useful optimization is to make the first tag of every Bake target the release tag and let CI check whether that tag already exists in the registry.

A simplified `check-image-versions.sh`:

```sh
#!/usr/bin/env sh
set -eu

mkdir -p .build

env_file=".build/image-version.env"
missing_targets_file=".build/missing-targets"

build_images="false"
build_targets=""

rm -f "$missing_targets_file"

bake_json="$(docker buildx bake --print all)"

printf '%s' "$bake_json" \
  | jq -r '.target | to_entries[]
      | select((.value.tags // []) | length > 0)
      | [.key, .value.tags[0]]
      | @tsv' \
  | while IFS="$(printf '\t')" read -r target image_ref; do
      if oras manifest fetch "$image_ref" >/dev/null 2>&1; then
        echo "Found existing image for target $target: $image_ref"
      else
        echo "Missing image for target $target: $image_ref"
        printf '%s\n' "$target" >> "$missing_targets_file"
      fi
    done

if [ -s "$missing_targets_file" ]; then
  build_images="true"
  build_targets="$(paste -sd, "$missing_targets_file")"
fi

{
  printf 'BUILD_IMAGES=%s\n' "$build_images"
  printf 'BUILD_TARGETS=%s\n' "$build_targets"
} > "$env_file"
```

The job exports a dotenv artifact:

```yaml
check-image-versions:
  stage: preflight
  image: docker:27
  script:
    - scripts/check-image-versions.sh
  artifacts:
    reports:
      dotenv: .build/image-version.env
```

Downstream jobs can then skip themselves if all release tags already exist:

```yaml
script:
  - if [ "$BUILD_IMAGES" != "true" ]; then echo "All release tags already exist; skipping."; exit 0; fi
```

This works well if you treat release tags as immutable.

The important governance point: if a Dockerfile changes, the corresponding release counter must be bumped. Otherwise the pipeline may correctly conclude that the release tag already exists. A policy can enforce that image-relevant changes must be accompanied by a version or release change.

## Internal CA Bundle as an OCI Artifact

Internal certificate authorities are a common source of messy Dockerfiles.

A weak pattern looks like this:

```dockerfile
ADD https://internal.example.local/ca-bundle.crt /usr/local/share/ca-certificates/internal.crt
```

That is convenient, but it has poor supply-chain properties:

- the certificate file is not versioned with the image release
- the build depends on a live HTTP endpoint
- the image does not record which CA bundle was used
- there may be no digest or checksum check
- reviews do not show certificate changes clearly

A cleaner pattern is to publish the CA bundle as an OCI artifact in your registry and pull it with ORAS during CI.

The repository stores only expectations and metadata, for example:

```text
security/ca-bundle.sha256
```

The registry stores the actual CA bundle:

```text
registry.example.com/platform/ca-bundle/internal-ca:<version>
```

A simplified verification script:

```sh
#!/usr/bin/env sh
set -eu

: "${CERTS_REF:?CERTS_REF is required}"

CERTS_DIR="${CERTS_DIR:-.build/certs}"
CERTS_DIGEST_FILE="${CERTS_DIGEST_FILE:-.build/certs.digest}"
CERTS_ENV_FILE="${CERTS_ENV_FILE:-.build/certs.env}"
CERTS_CHECKSUM_FILE="${CERTS_CHECKSUM_FILE:-security/ca-bundle.sha256}"

rm -rf "$CERTS_DIR"
mkdir -p "$CERTS_DIR"

certs_digest="$(oras manifest fetch --descriptor "$CERTS_REF" | jq -r '.digest')"
test -n "$certs_digest"
test "$certs_digest" != "null"

if [ -n "${CERTS_EXPECTED_DIGEST:-}" ]; then
  test "$certs_digest" = "$CERTS_EXPECTED_DIGEST"
fi

oras pull "$CERTS_REF" -o "$CERTS_DIR"

crt_count="$(find "$CERTS_DIR" -type f \( -name '*.crt' -o -name '*.pem' \) | wc -l | tr -d ' ')"
test "$crt_count" -gt 0

if find "$CERTS_DIR" -type f \( -name '*.key' -o -name '*_key' -o -name '*.p12' -o -name '*.pfx' \) | grep -q .; then
  echo "CA bundle contains private key material" >&2
  exit 1
fi

find "$CERTS_DIR" -type f \( -name '*.crt' -o -name '*.pem' \) -print0 \
  | xargs -0 -n1 openssl x509 -in >/dev/null

if [ -s "$CERTS_CHECKSUM_FILE" ]; then
  tmp_checksums="$(mktemp)"
  grep -v '^[[:space:]]*#' "$CERTS_CHECKSUM_FILE" | grep -v '^[[:space:]]*$' > "$tmp_checksums"
  if [ -s "$tmp_checksums" ]; then
    (cd "$CERTS_DIR" && sha256sum -c "$tmp_checksums")
  fi
  rm -f "$tmp_checksums"
fi

printf '%s\n' "$certs_digest" > "$CERTS_DIGEST_FILE"

{
  printf 'CERTS_DIGEST=%s\n' "$certs_digest"
  printf 'CA_BUNDLE_REF=%s\n' "$CERTS_REF"
  printf 'CA_BUNDLE_DIGEST=%s\n' "$certs_digest"
} > "$CERTS_ENV_FILE"

echo "Verified CA bundle $CERTS_REF@$certs_digest"
```

The CI job publishes `.build/certs.env` as a dotenv artifact:

```yaml
verify-ca-bundle:
  stage: verify
  image: docker:27
  script:
    - scripts/verify-ca-bundle.sh
  artifacts:
    reports:
      dotenv: .build/certs.env
    paths:
      - .build/certs/
      - .build/certs.digest
```

The values `CA_BUNDLE_REF` and `CA_BUNDLE_DIGEST` then flow into Bake and become OCI labels on every image:

```hcl
target "_common" {
  labels = {
    "de.example.ca-bundle.ref"    = "${CA_BUNDLE_REF}"
    "de.example.ca-bundle.digest" = "${CA_BUNDLE_DIGEST}"
  }
}
```

This gives you a simple audit story:

> This image was built from this Git commit, with this CA bundle reference and this CA bundle digest.

That is much stronger than “the Dockerfile downloaded whatever the internal endpoint returned at build time”.

## External Downloads: Checksums First, Signatures Where Possible

Many tool images need external binaries: `kubectl`, CLI tools, upload clients, vendor packages, runtime installers.

The minimum standard should be:

- pin the version
- use HTTPS
- do not use `curl -k` or `wget --no-check-certificate`
- verify a checksum stored in Git or in a reviewed artifact manifest
- run a smoke test after installation

For example:

```dockerfile
ARG TOOL_VERSION
ARG TOOL_SHA256

RUN set -eux; \
    curl -fsSLo /usr/local/bin/tool "https://downloads.example.org/tool/${TOOL_VERSION}/tool-linux-amd64"; \
    echo "${TOOL_SHA256}  /usr/local/bin/tool" | sha256sum -c -; \
    chmod 0755 /usr/local/bin/tool; \
    tool --version
```

A checksum downloaded from the same directory as the binary is still useful for detecting corruption or inconsistent downloads, but it is not a strong provenance check if the upstream download location itself is compromised.

For tools that publish signatures, verify them. For example, Kubernetes publishes signatures and certificates for release artifacts, so a stronger `kubectl` flow is:

```text
download kubectl
download kubectl.sha256
download kubectl.sig
download kubectl.cert
verify sha256
verify cosign signature with expected certificate identity and OIDC issuer
copy verified binary into the image
```

Even better, move external artifact verification out of Dockerfiles:

```text
verify job
  → download external artifact
  → verify checksum/signature
  → store verified artifact as CI artifact
  → Docker build copies verified artifact from a named BuildKit context
```

Bake can pass the verified artifact directory as a named context:

```hcl
target "kubectl" {
  contexts = {
    kubectl_artifacts = ".build/tools/kubectl"
  }
}
```

And the Dockerfile becomes boring:

```dockerfile
ARG TARGETARCH

COPY --from=kubectl_artifacts linux-${TARGETARCH}/kubectl /usr/local/bin/kubectl

RUN chmod 0755 /usr/local/bin/kubectl \
 && kubectl version --client=true
```

Boring Dockerfiles are good Dockerfiles.

## Multi-Arch Build: Temporary Images, Final Manifests

A practical multi-arch setup is to build per-architecture images natively and publish final manifest lists afterwards.

In GitLab CI:

```yaml
build-images:
  stage: build
  image: docker:27
  parallel:
    matrix:
      - ARCHITECTURE:
          - amd64
          - arm64
  tags:
    - docker
    - $ARCHITECTURE
  services:
    - name: docker:27-dind
      command: ["--tls=false"]
  script:
    - scripts/build-arch-images.sh
```

The build script creates temporary architecture-specific image references:

```sh
tmp_ref() {
  target="$1"
  printf '%s/__tmp/%s:%s-%s\n' "$REGISTRY" "$target" "$IMAGE_BUILD_ID" "$ARCHITECTURE"
}
```

Then it generates a small Bake override file:

```hcl
target "kubectl" {
  platforms = ["linux/amd64"]
  tags = ["registry.example.com/platform/images/__tmp/kubectl:<commit>-amd64"]
}
```

The publish job creates final multi-arch tags:

```sh
docker buildx imagetools create -t "$final_tag" \
  "registry.example.com/platform/images/__tmp/kubectl:<commit>-amd64" \
  "registry.example.com/platform/images/__tmp/kubectl:<commit>-arm64"
```

This keeps platform policy in Bake while still using native GitLab runners for each architecture.

## Smoke Tests

A release pipeline should test the images it actually published.

A simple smoke script can map targets to commands:

```sh
case "$target" in
  alpine|alpine-toolbox)
    docker run --rm --entrypoint sh "$image_ref" -c 'test -s /etc/ssl/certs/ca-certificates.crt'
    ;;
  ansible)
    docker run --rm --entrypoint ansible "$image_ref" --version
    ;;
  kubectl)
    docker run --rm --entrypoint kubectl "$image_ref" version --client=true
    ;;
  node*)
    docker run --rm --entrypoint node "$image_ref" --version
    ;;
  python*)
    docker run --rm --entrypoint python3 "$image_ref" --version
    ;;
  maven*)
    docker run --rm --entrypoint mvn "$image_ref" --version
    ;;
  *)
    echo "No smoke test configured for target $target" >&2
    exit 1
    ;;
esac
```

The important rule: no image target should be publishable without a smoke test.

That rule belongs in policy too.

## Signing With Cosign

After publishing and smoke-testing, sign the final image digests.

A signing job can decrypt a SOPS-encrypted Cosign key with an age key provided by CI secrets:

```yaml
sign-images:
  stage: sign
  image: docker:27
  before_script:
    - scripts/install-ci-tools.sh oras cosign sops
    - test -n "$SOPS_AGE_KEY_B64"
    - test -n "$COSIGN_PASSWORD"
    - mkdir -p .build
    - echo "$SOPS_AGE_KEY_B64" | base64 -d > .build/sops-age.key
    - chmod 600 .build/sops-age.key
    - export SOPS_AGE_KEY_FILE=".build/sops-age.key"
    - sops --decrypt secrets/cosign.key.sops > .build/cosign.key
    - chmod 600 .build/cosign.key
  script:
    - scripts/sign-images.sh
```

The script should sign immutable digests, not just mutable tags:

```sh
descriptor="$(oras manifest fetch --descriptor "$image_ref")"
image_digest="$(printf '%s' "$descriptor" | jq -r '.digest')"

cosign sign --yes --key "$COSIGN_KEY" "${image_ref%@*}@$image_digest"
```

For multi-arch images, sign the image index and, if desired, child manifests:

```sh
if [ "$media_type" = "application/vnd.oci.image.index.v1+json" ]; then
  oras manifest fetch "$image_ref" \
    | jq -r '.manifests[].digest' \
    | sort -u \
    | while IFS= read -r child_digest; do
        cosign sign --yes --key "$COSIGN_KEY" "${image_ref%@*}@$child_digest"
      done
fi
```

The public key can live in `security/cosign.pub` so verification is easy for consumers.

## Hadolint: Generic Dockerfile Hygiene

Hadolint should be the first line of defense. It catches common Dockerfile and shell mistakes before you write custom policies.

A repository-level `.hadolint.yaml` can define the baseline:

```yaml
failure-threshold: error

trustedRegistries:
  - registry.example.com
  - registry.example.com/dockerhub/library
  - mcr.microsoft.com

override:
  error:
    - DL3007 # using latest
    - DL3026 # use only trusted registries
```

Hadolint is great for generic rules, such as:

- do not use `latest`
- use trusted registries
- avoid common package manager mistakes
- catch shell issues through ShellCheck integration
- enforce sane Dockerfile patterns

But Hadolint does not know your organization’s image release model. That is where Conftest comes in.

## Conftest: Your Governance Layer

Conftest lets you write custom rules in Rego and test structured configuration.

In an image monorepo, useful policy targets include:

```text
docker-bake.hcl
.gitlab-ci.yml
images/*/Dockerfile
scripts/*.sh
rendered Docker build metadata
docker inspect output
```

Example rules for Dockerfiles:

```rego
package dockerfiles

import rego.v1

deny contains msg if {
  instruction := input.instructions[_]
  regex.match(`(?i)\bcurl\b.*\s-k`, instruction.value)
  msg := sprintf("%s:%d uses curl with TLS verification disabled", [instruction.file, instruction.line])
}

deny contains msg if {
  instruction := input.instructions[_]
  regex.match(`(?i)\bwget\b.*--no-check-certificate`, instruction.value)
  msg := sprintf("%s:%d uses wget without certificate verification", [instruction.file, instruction.line])
}

deny contains msg if {
  instruction := input.instructions[_]
  regex.match(`(?i)curl\s+.*\|\s*(sh|bash)`, instruction.value)
  msg := sprintf("%s:%d pipes curl into a shell", [instruction.file, instruction.line])
}
```

Example rules for Bake targets:

```rego
package bake

import rego.v1

deny contains msg if {
  target_name := object.keys(input.target)[_]
  startswith(target_name, "_") == false

  target := input.target[target_name]
  count(target.tags) > 0

  not target.inherits[_] == "_common"

  msg := sprintf("target %q must inherit _common", [target_name])
}

deny contains msg if {
  target_name := object.keys(input.target)[_]
  target := input.target[target_name]
  tag := target.tags[_]

  regex.match(`:(latest|stable)$`, tag)

  msg := sprintf("target %q publishes forbidden mutable tag: %s", [target_name, tag])
}

deny contains msg if {
  target_name := object.keys(input.target)[_]
  target := input.target[target_name]
  first_tag := target.tags[0]

  not regex.match(`:[0-9][0-9A-Za-z._-]*-r[0-9]+$`, first_tag)

  msg := sprintf("target %q first tag must be an immutable release tag, got: %s", [target_name, first_tag])
}
```

Example rules for GitLab CI:

```rego
package gitlab_ci

import rego.v1

deny contains msg if {
  job_name := object.keys(input)[_]
  job := input[job_name]
  is_object(job)

  image := object.get(job, "image", "")
  endswith(image, ":latest")

  msg := sprintf("job %q uses latest image: %s", [job_name, image])
}

deny contains msg if {
  job_name := object.keys(input)[_]
  job := input[job_name]
  is_object(job)

  job.stage == "sign"
  not job_needs_stage(job, "smoke")

  msg := sprintf("sign job %q must depend on smoke tests", [job_name])
}

job_needs_stage(job, stage_name) if {
  need := job.needs[_]
  contains(sprintf("%v", [need]), stage_name)
}
```

This is where the monorepo becomes very powerful. One change to policy affects every image. You do not need to remember whether repository number 17 has already copied the new policy template.

## Pre-Commit Hooks: Fast Feedback Before CI

Policy checks should run in CI, but developers should not have to wait for CI to find basic mistakes.

A `.pre-commit-config.yaml` can run the same local checks:

```yaml
repos:
  - repo: https://github.com/hadolint/hadolint
    rev: v2.14.0
    hooks:
      - id: hadolint-docker

  - repo: https://github.com/open-policy-agent/conftest
    rev: v0.62.0
    hooks:
      - id: conftest-test
        name: conftest dockerfiles
        files: ^images/.*/Dockerfile$
        args:
          - --policy
          - policy/dockerfiles

  - repo: local
    hooks:
      - id: policy-lint
        name: policy lint
        entry: make policy-lint
        language: system
        pass_filenames: false
```

A Makefile target makes the local workflow easy:

```makefile
install:
	asdf install
	pre-commit install

policy-lint:
	scripts/lint-policies.sh
```

This gives you two layers:

```text
pre-commit: fast local guardrail
CI: authoritative gate
```

Pre-commit is not a security boundary. It is a developer experience improvement. CI is the judge.

## What to Put Into Policy

A good governance setup should block classes of problems, not just individual mistakes.

Examples:

### Dockerfile Policies

- No `curl -k`
- No `wget --no-check-certificate`
- No `curl | sh`
- No `latest` downloads
- No unpinned package installs for critical tools
- No private keys in build contexts
- No direct `docker.io` unless routed through an approved registry proxy
- Required OCI labels
- Runtime images must use a non-root user unless explicitly exempted

### Bake Policies

- Every real target inherits `_common`
- Every real target inherits a platform profile such as `_multiarch` or `_amd64`
- The first tag is an immutable release tag
- No forbidden mutable tags
- No duplicate tags across targets
- Every target with tags is included in group `all`
- Every image uses the correct release counter family

### GitLab CI Policies

- No `docker:latest`
- No `docker:dind` without a pinned version
- No `allow_failure` for policy or signing jobs
- Publish/sign jobs only run on protected branches or tags
- Signing depends on smoke tests
- Build depends on CA bundle verification
- No `--provenance=false` unless explicitly documented and approved

### Artifact Policies

- External tools must have versions and checksums
- Checksums should be stored in Git or a reviewed artifact manifest
- Signatures should be verified where upstream provides them
- Internal artifacts should come from the internal registry
- Generated artifacts should be labeled, signed and traceable

## Auditing and Logging

Auditing is one of the strongest arguments for this pattern.

In a multi-repo setup, the audit trail is distributed:

```text
Who changed the CA bundle?
Which images were rebuilt?
Which repos picked up the new policy?
Which repos still publish mutable tags?
Which CI jobs still use docker:latest?
```

You can answer those questions, but you often need scripts, APIs and dashboards to reconstruct the whole picture.

In a monorepo, the relationship is more natural:

- one MR updates the CA bundle reference or expected digest
- one pipeline verifies the bundle
- affected targets are visible in one build definition
- release counters are reviewed in one place
- labels and digests are applied consistently
- signing logs are in one pipeline graph
- policy changes are reviewed next to the images they affect

That is not just convenience. It is operational clarity.

## Monorepo Does Not Mean “No Modularity”

A monorepo should not become a junk drawer.

You still need boundaries:

- image families
- clear target names
- CODEOWNERS
- review rules
- documented release counters
- explicit platform profiles
- per-target README files
- local exception mechanisms for policies

The point is not to remove structure. The point is to put the structure where it can be enforced.

## A Word on GitLab CI Components and Renovate

GitLab CI components are useful. Renovate is useful.

They solve different problems.

```text
GitLab CI components reduce CI duplication.
Renovate reduces update toil.
A monorepo reduces governance drift.
```

In a distributed setup, you can combine components, Renovate and central policy bundles to approximate central governance. That may be the right choice for application repositories or independently owned services.

For internal base and tool images, the tradeoff often looks different. These images share a trust model, a registry, a release flow and a policy set. Centralizing them can make the system simpler, not more complex.

## Practical Recommendations

If you build an image monorepo, I would start with these rules:

1. Make `docker-bake.hcl` the source of truth for targets, tags, versions, labels and platforms.
2. Keep Dockerfiles focused on image content.
3. Treat the first tag of every target as the immutable release tag.
4. Use release counters to distinguish tool versions from image rebuilds.
5. Pull internal CA bundles as OCI artifacts with ORAS.
6. Verify CA bundles with digest checks, checksums and certificate validation.
7. Put CA bundle reference and digest into OCI labels.
8. Run Hadolint for generic Dockerfile quality.
9. Run Conftest for organization-specific governance.
10. Install pre-commit hooks for fast local feedback.
11. Build architecture-specific temporary images.
12. Publish final multi-arch manifest lists.
13. Smoke-test the published images.
14. Sign final digests with Cosign.
15. Avoid mutable tags for production use.
16. Avoid direct unverified downloads in Dockerfiles.
17. Keep CI images pinned.
18. Make policy changes visible and reviewed.

## Conclusion

A Docker images monorepo is not automatically better than multiple repositories.

But if the images share the same trust model, release process, labels, registry, CA bundle, signing requirements and CI/CD rules, a monorepo can be the more honest architecture.

It gives you one place to define the build graph, one place to enforce policy, one place to review release metadata and one place to audit supply-chain decisions.

The real question is not:

> Can this be done with multiple repositories?

Of course it can.

The better question is:

> How much additional machinery do we need to keep multiple repositories consistent?

If the answer is GitLab components, Renovate, central policy bundles, rollout audits, drift checks and manual exception tracking, then the architecture is already asking for centralization.

For internal base images, that centralization often belongs in the repository itself.
