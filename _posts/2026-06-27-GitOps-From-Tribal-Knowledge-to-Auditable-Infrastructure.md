---
title: "GitOps: From Tribal Knowledge to Auditable Infrastructure"
description: "GitOps turns infrastructure changes into reviewed, versioned, continuously reconciled code—and replaces operational memory with an auditable system of record."
layout: post
date: 2026-06-27 14:20:00 +0200
tags: [GitOps, DevOps, Kubernetes, Ansible, Platform Engineering]
excerpt_separator: "<!--more-->"
---

Infrastructure used to be full of stories that began with, "Ask Alex, they know how that server works."

Someone had installed a package over SSH, changed a configuration file during an incident, added a cron job six months later, and opened a firewall port that nobody documented. The server might have been stable for years, but its real configuration existed partly on disk, partly in a ticket system, and partly in one person's memory.

We improved this model with scripts, configuration management, Infrastructure as Code, and immutable images. GitOps takes the next step: it turns Git into the reviewed and versioned declaration of what our systems should look like, then uses software agents to continuously reconcile reality with that declaration.

That makes GitOps much more than "YAML in a repository." It is an operating model for making infrastructure visible, reproducible, auditable, and less dependent on privileged individuals.

<!--more-->

## What GitOps Actually Is

GitOps applies familiar software development practices to infrastructure and operations. The desired state of a system is declared in version control. Changes are proposed through commits and pull requests. Automated checks validate them. Controllers compare the declared state with the running system and continuously work to close the difference.

A useful GitOps model has four properties:

1. **The desired state is declarative.** We describe what should exist, not a sequence of manual steps someone must remember.
2. **The desired state is versioned.** Changes have authors, timestamps, reviews, and history.
3. **Changes are applied automatically.** An agent pulls approved state from the repository instead of relying on an operator to push changes from a laptop.
4. **The system is continuously reconciled.** Drift is detected and corrected, not merely discovered during the next deployment.

Git is the source of truth for *intent*. The running environment remains the source of truth for *reality*. GitOps connects the two through a reconciliation loop.

That distinction is important. A green pull request does not prove that production is healthy. It proves that a proposed declaration passed its checks. The controller and the platform must still report whether the desired state was accepted, applied, and became operational.

## Before Automation: The Server as a Historical Artifact

Imagine a traditional web server managed by a small operations team.

The initial setup might look like this:

```text
ssh production-web-01
apt install nginx
vim /etc/nginx/sites-enabled/application.conf
systemctl restart nginx
```

Months later, another administrator changes a timeout during an incident. Someone else installs a monitoring agent. A developer temporarily modifies an environment variable to test a fix. A certificate renewal script is added directly to root's crontab. The server continues working, so nobody spends time reconstructing its complete history.

Eventually, the machine becomes unique.

Rebuilding it means reading shell history, comparing directories with another server, searching old tickets, and interviewing people. If the disk fails or the knowledgeable administrator leaves, the organization discovers that the server was not merely compute. It was an undocumented database of operational decisions.

This model has several problems:

- changes are difficult to review before they happen
- the current state is hard to explain
- two supposedly identical servers drift apart
- rollback depends on memory and backups
- access to production becomes the main control mechanism
- knowledge concentrates in a small number of people
- disaster recovery is mostly theoretical

The problem is not that SSH is inherently bad. SSH is a useful diagnostic and recovery tool. The problem is using interactive access as the primary configuration interface.

## Configuration Management: Ansible as a Major Improvement

Configuration management tools such as Ansible replace many manual procedures with versioned, repeatable automation.

Instead of documenting "install Nginx and edit these five settings," we can describe the target state:

```yaml
- name: Configure web servers
  hosts: web
  become: true
  roles:
    - baseline
    - nginx
    - application
```

Roles can install packages, render configuration files, create users, configure services, and restart components only when required. Inventories describe which machines belong to which environment. Variables make intended differences explicit.

This is a substantial operational improvement:

- configuration is stored in code
- changes can be reviewed
- environments can be rebuilt
- repeated runs reduce drift
- knowledge moves from shell history into playbooks
- teams can test changes before applying them broadly

Ansible also introduces idempotence as an operational discipline. A playbook should be safe to run repeatedly and should converge a host toward the declared state.

But Ansible is not automatically GitOps.

In a common Ansible model, an operator or CI job pushes changes into the environment at a particular moment. If someone modifies the server afterward, the drift may remain until the next playbook run. The target does not usually watch the repository and continuously reconcile itself.

That does not make Ansible inferior. It makes it a different tool with a different control model. Ansible is excellent for bootstrapping machines, managing operating systems, orchestrating procedural tasks, and operating systems that do not expose a Kubernetes-style reconciliation API.

The important evolution is this:

```text
Manual operations
    ↓
Repeatable scripts
    ↓
Declarative configuration management
    ↓
Versioned infrastructure and automated delivery
    ↓
Continuous reconciliation
```

Each step reduces ambiguity. GitOps builds on the earlier lessons rather than making them obsolete.

## Infrastructure as Code Is Necessary but Not Sufficient

Infrastructure as Code gives us a machine-readable description of infrastructure. Terraform, OpenTofu, Pulumi, CloudFormation, Ansible, Kubernetes manifests, and other tools can make infrastructure reproducible and reviewable.

But storing infrastructure code in Git does not by itself create GitOps.

A repository may contain perfect Terraform code while production is changed manually through the cloud console. A Kubernetes repository may be updated only after someone edits the cluster through a dashboard. An Ansible playbook may describe most of a server while emergency modifications remain permanently outside automation.

In these cases, Git is documentation of what the system looked like at some point. It is not the authoritative desired state.

GitOps closes that gap by making the repository the normal path for change and by continuously comparing intent with reality.

## Kubernetes Through a Dashboard: Convenient but Opaque

Kubernetes dashboards are useful for exploration and troubleshooting. They become dangerous when they are the primary operating model.

Consider a team deploying an application through a graphical dashboard:

1. An engineer creates a Deployment and Service.
2. Another engineer changes the image tag during a release.
3. Someone edits a ConfigMap to resolve an incident.
4. A replica count is increased before a marketing event.
5. A security setting is added after an audit.
6. A namespace administrator changes resource limits to stop evictions.

The cluster now contains the result of several reasonable decisions. But where is the complete explanation?

The dashboard may show the current objects, yet it usually cannot answer the full set of operational questions:

- Why was this value changed?
- Who reviewed it?
- Which ticket or incident justified it?
- Was the same change applied to staging?
- What did the configuration look like last month?
- Can we recreate the namespace in another cluster?
- Which manual change will disappear during the next deployment?

An audit log can show that an API request happened. It does not necessarily explain the engineering intent behind the request.

Click-driven operations also create a subtle permission problem. Because the dashboard is the deployment mechanism, many users need broad write access to the cluster. The organization then tries to recover safety through RBAC, approval meetings, and procedural rules around a fundamentally imperative workflow.

## Kubernetes with Flux: Intent, Review, and Reconciliation

Now consider the same platform operated with Flux.

The repository might contain:

```text
clusters/
  production/
    flux-system/
    infrastructure.yaml
    applications.yaml
infrastructure/
  ingress/
  observability/
  policies/
apps/
  checkout/
    base/
    production/
```

A deployment change follows a different path:

1. An engineer changes an image version or manifest in a branch.
2. CI validates YAML, renders Kustomize overlays, checks policies, and optionally runs security scans.
3. A pull request shows the exact proposed difference.
4. Reviewers discuss the operational impact in context.
5. The approved change is merged.
6. Flux notices the new revision and reconciles the cluster.
7. Flux reports whether the desired state became ready.

The operator no longer needs a local kubeconfig with broad production privileges to perform a normal deployment. The cluster pulls approved intent through a controller with a defined identity.

If someone manually changes a managed Deployment, Flux detects the drift and restores the declared state. If the manual change was legitimate, the durable fix is to update Git. The operational model teaches the organization where truth lives.

This is the moment GitOps becomes more than deployment automation: the controller continuously defends the declared state.

For a hands-on example, see [Learning GitOps with Flux, k3d, and the Flux CLI](/2026/06/18/Learning-GitOps-with-Flux-k3d-and-the-Flux-CLI/). The same model can be extended across environments and clusters, as described in [Managing Multiple Kubernetes Clusters with Flux](/2026/06/18/Managing-Multiple-Kubernetes-Clusters-with-Flux/).

## The Repository as Executable Documentation

Traditional documentation describes what someone believes the infrastructure should look like. GitOps configuration is stronger because the platform actively consumes it.

If a repository defines namespaces, applications, policies, network rules, monitoring components, resource limits, and release versions, the code becomes a documented version of the infrastructure. It can be searched, reviewed, compared, and tested. A new engineer can follow references from a cluster entry point down to the workloads it contains.

This does not mean that code eliminates documentation.

Manifests show *what* should exist. They do not always explain *why* a decision was made, which trade-offs were considered, or how humans should respond when something fails. Good GitOps repositories still need:

- a clear structure
- README files
- naming conventions
- Architecture Decision Records
- operational runbooks
- ownership metadata
- links to dashboards and alerts
- recovery and break-glass procedures

The advantage is that prose and executable state can live close together. Documentation is more likely to remain accurate when it is reviewed alongside the configuration it explains.

## Auditability: More Than a List of API Calls

GitOps creates a useful chain of evidence:

```text
Requirement or incident
    ↓
Commit
    ↓
Pull request discussion
    ↓
Automated validation
    ↓
Approval
    ↓
Merge
    ↓
Controller reconciliation
    ↓
Runtime status
```

This chain answers different questions at different layers.

Git history can show:

- who proposed a change
- the exact before-and-after state
- when the change was merged
- which reviewers approved it
- which issue or incident was referenced

CI can show:

- which tests and policy checks ran
- which artifact or manifest was produced
- whether required controls passed

Flux can show:

- which Git revision was observed
- whether reconciliation succeeded
- which resources failed to become ready
- whether the cluster is still aligned with the repository

Platform and cloud audit logs can show:

- which controller identity called an API
- which runtime actions occurred
- whether someone used an emergency access path

No single log is sufficient. Together they provide much stronger evidence than "an administrator changed it in the dashboard."

GitOps does not make every change trustworthy automatically. Auditability still depends on protected branches, meaningful review, strong identity, retention, controller security, and controls that prevent one person from silently approving their own high-risk changes.

## Reducing the Single Point of Failure Called a Person

Organizations often discuss high availability for servers while accepting low availability for knowledge.

If only one engineer knows how production is assembled, that person is part of the critical path for deployments, incidents, recovery, and onboarding. They may be highly capable, but the operating model is fragile. Vacations become risk events. Resignations become migration projects.

GitOps reduces this dependency by moving operational knowledge into shared artifacts:

- repositories show the desired state
- pull requests preserve technical discussion
- commits show how the system evolved
- CI expresses validation rules
- controllers encode the application mechanism
- runbooks describe human response

This does not make expertise unnecessary. Someone still needs to understand Kubernetes, networking, security, storage, and the business context. GitOps changes where that expertise is recorded and how other people can participate.

The goal is not to make every engineer interchangeable. The goal is to prevent critical infrastructure from depending on facts that exist only in one person's head.

## Drift Becomes a Managed Condition

Without continuous reconciliation, drift is normal.

A hotfix changes production but not staging. A console setting differs from Terraform. A manually created Kubernetes object survives for years because nobody knows who owns it. The longer the system runs, the less accurately its repositories describe reality.

GitOps treats drift as a condition to detect and resolve.

For managed resources, the controller can restore the declared state automatically. For changes it cannot safely correct, it can report a failed reconciliation and make the discrepancy visible. Either behavior is better than silent divergence.

There is an important operational consequence: manual fixes may be reverted.

Teams need a defined break-glass process. During an incident, direct intervention may be justified. But the workflow should make the exception explicit:

1. record the emergency action
2. pause reconciliation only where necessary
3. apply the minimum safe change
4. update Git as soon as possible
5. restore reconciliation
6. review why the normal delivery path was insufficient

The break-glass path is not a failure of GitOps. Pretending emergencies never happen would be. A mature system makes emergency access rare, visible, and temporary.

## Secrets Require a Separate Design

Putting infrastructure in Git does not mean putting plaintext secrets in Git.

A useful GitOps design separates versioned intent from secret material. Common approaches include:

- encrypting secrets with SOPS and age before committing them
- using External Secrets Operator to reference a managed secret store
- using Sealed Secrets for cluster-targeted encrypted resources
- generating short-lived credentials through workload identity

The repository should describe which secret a workload needs and how it is delivered. It should not expose the credential itself.

Secret handling also affects disaster recovery. If a cluster can be recreated from Git but the encryption keys, external secret store, or identity bootstrap process are undocumented, the recovery path is incomplete.

## GitOps Beyond Application Deployments

GitOps can manage much more than image tags.

### Platform Components

Ingress controllers, certificate management, policy engines, observability stacks, and operators can be installed and upgraded through the same reviewed process.

### Policies

Kyverno or Gatekeeper policies can be versioned, tested, and rolled out gradually. Security controls become visible platform contracts instead of hidden admission settings.

### Multi-Cluster Configuration

Repositories can separate shared platform capabilities from cluster-specific overlays. A change to a common policy can be reviewed once and reconciled across a fleet, while environment differences remain explicit.

### Application Configuration

Teams can manage Deployments, Services, autoscaling, network policies, and configuration through pull requests. Platform teams can define guardrails without becoming a ticket queue for every release.

### Observability

Alert rules, dashboards, recording rules, and telemetry collectors can be treated as versioned operational assets. This connects application changes with the signals used to operate them.

GitOps is most valuable where the managed system already exposes a declarative API and controllers can observe convergence. It is less natural for one-time procedural actions, database migrations with irreversible steps, or operations requiring complex human judgment.

## Ansible and GitOps Can Work Together

The comparison between Ansible and Flux should not become a tool war.

Ansible is often the right tool for:

- configuring operating systems
- bootstrapping Kubernetes nodes
- installing a GitOps controller
- managing network appliances
- coordinating maintenance procedures
- operating legacy systems

Flux is well suited to:

- continuously reconciling Kubernetes resources
- delivering applications and platform components
- managing dependencies between cluster configurations
- detecting and correcting drift
- reporting reconciliation status

A practical architecture might use Terraform or OpenTofu to create cloud infrastructure, Ansible to configure base systems, and Flux to operate Kubernetes workloads. All three can use Git, review, testing, and automation, even though only the continuously reconciled part follows the complete GitOps model.

The value comes from clear ownership boundaries, not from forcing every operation through one tool.

## Why GitOps Is So Effective

GitOps combines several improvements that reinforce each other.

### Safer Changes

Pull requests expose the exact proposed difference before production changes. Automated checks catch syntax, policy, and rendering problems early.

### Faster Recovery

If a cluster or namespace must be rebuilt, the desired state already exists in a form a controller can apply. Recovery becomes an exercised deployment path instead of a separate collection of documents.

### Consistency

Shared bases and explicit overlays reduce accidental differences between environments. Drift becomes visible rather than normal.

### Better Collaboration

Developers, operators, security engineers, and architects can discuss a concrete change in the same review. Decisions no longer disappear into chat messages or dashboard sessions.

### Reduced Privilege

Normal changes can flow through Git and controller identities. Fewer humans need broad interactive access to production.

### Scalable Governance

Policy checks, ownership rules, and required approvals can be applied consistently. Governance becomes part of the delivery system instead of a manual checkpoint added at the end.

### Operational Memory

The repository preserves how the platform evolved. It does not replace people, but it gives their decisions a durable home.

## What GitOps Does Not Solve

GitOps is powerful, but it is not magic.

### Bad Changes Are Still Bad

Flux will faithfully reconcile a broken declaration. Validation, staged rollouts, health checks, and rollback strategies remain necessary.

### Git Can Become a Bottleneck

Poor repository structure, slow reviews, unclear ownership, and excessive centralization can turn every change into platform-team queueing. A successful model gives teams autonomy within explicit boundaries.

### Reconciliation Needs Security

A controller with permission to change production is a critical component. Its credentials, source configuration, network access, and update process require careful protection.

### Runtime Debugging Still Matters

Git explains intended state. It does not explain every crash, latency spike, kernel issue, or network failure. Teams still need observability and operational skill.

### Not Every Operation Is Declarative

Database schema migrations, data repair, certificate authority changes, and complex incident actions may require ordered procedures and human decisions. Trying to force them into a purely declarative model can hide risk rather than reduce it.

### Repository Availability Is a Dependency

Recovery planning must consider Git hosting, controller caches, deploy keys, artifact registries, and bootstrap credentials. "Everything is in Git" is incomplete if nobody can access Git during a disaster.

## A Practical Adoption Path

GitOps adoption works best as an incremental operating-model change.

### 1. Identify Current Mutation Paths

List every way production can change: dashboards, `kubectl`, CI jobs, Terraform runs, Ansible, cloud consoles, scripts, and manual API calls. Hidden mutation paths are where drift begins.

### 2. Choose a Bounded Starting Point

Start with one non-critical application or platform component. Learn how reconciliation, repository structure, observability, and rollback behave before expanding.

### 3. Establish Repository Ownership

Define who owns each directory, who reviews changes, and which teams can approve production modifications. Use CODEOWNERS where appropriate, but do not substitute it for actual collaboration.

### 4. Add Validation Before Reconciliation

Render manifests, validate schemas, run policy checks, scan images, and test overlays in pull requests. Controllers provide late feedback; CI should provide early feedback.

### 5. Design Secret Management

Choose the encryption, external secret, or workload identity model before sensitive configuration enters the repository.

### 6. Make Controller Status Visible

Teams need to know whether reconciliation succeeded. Integrate status with pull requests, alerts, dashboards, or chat systems so a merge is not mistaken for a successful deployment.

### 7. Define the Break-Glass Process

Document who can pause reconciliation, how emergency access is granted, and how manual changes return to Git.

### 8. Remove Uncontrolled Mutation Paths Gradually

Once the GitOps path is reliable, reduce direct write access and click-driven changes. Do not remove emergency access; make it explicit and auditable.

### 9. Test Reconstruction

Recreate a namespace, environment, or cluster from the repository. This is the strongest test of whether Git truly represents the system.

### 10. Review the Human Experience

Measure lead time, failed reconciliations, review latency, onboarding effort, and operational toil. GitOps should make safe changes easier, not merely move bureaucracy into pull requests.

## The Real Value of GitOps

The most important GitOps benefit is not that Git is fashionable or that Kubernetes controllers are technically elegant.

The benefit is the removal of ambiguity.

There should be a clear answer to what should be running, why it changed, who reviewed it, whether the change was applied, and whether reality still matches intent. Infrastructure should be reconstructable from shared artifacts instead of depending on a sequence of remembered actions.

GitOps turns infrastructure from a collection of historical accidents into a system that can explain and continuously rebuild itself.

## Conclusion

We moved from SSH sessions to scripts because repetition was safer than memory. We adopted Ansible and Infrastructure as Code because declarations were safer than undocumented procedures. GitOps extends the same logic by continuously reconciling running systems with reviewed, versioned intent.

It improves auditability, reproducibility, recovery, collaboration, and governance. It reduces the operational risk of knowledge concentrated in a few individuals. It makes infrastructure code serve as both an executable specification and a durable part of the system's documentation.

GitOps does not eliminate incidents, expertise, or judgment. It gives them a better operating environment.

The strongest platform is not the one only its original builders can operate. It is the one whose intent is visible, whose changes are explainable, and whose desired state can be restored without relying on somebody's memory.
