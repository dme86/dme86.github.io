---
title: "My Famous Formula: Speed = Process + Automation"
description: "Real engineering speed emerges when tools and processes solve explicit problems, success is measurable, and clear workflows are supported by reliable automation."
layout: post
date: 2026-06-27 15:30:00 +0200
tags: [Engineering, DevOps, Automation, CI/CD, Platform Engineering]
excerpt_separator: "<!--more-->"
---

Engineers spend a remarkable amount of time arguing about tools.

Should we use Renovate or Dependabot? Kubernetes or a simpler container platform? Flux or Argo CD? Terraform or OpenTofu? Helm, Kustomize, Docker, GitHub Actions, GitLab CI, Jenkins, Backstage—the list is endless, and every tool has enthusiastic supporters and experienced critics.

Those discussions are not useless. Tools have different capabilities, constraints, costs, and failure modes. But "Is this tool good?" is rarely the most important question.

The same problem appears when teams discuss processes. Someone proposes mandatory approvals, new push rules, another release gate, a branching policy, or a change board because it sounds mature or because another company does it. A process is adopted before anyone has defined which concrete failure it should prevent.

The better questions apply equally to tools and processes: What problem are we solving? Which system behavior should change? How easy will the new flow be to follow and automate? What will happen when it fails? Who will own it? Most importantly, how will we measure whether it worked?

That is the thinking behind my famous formula:

> **Speed = Process + Automation**

<!--more-->

This is not a decorative slogan. It describes how I think about modern software delivery. Real speed does not come from tools alone, from adding more rules, or from automating everything that moves. Speed emerges when a deliberately designed process is combined with reliable automation.

In this formula, *process* does not mean bureaucracy. It means the simplest explicit flow that solves a demonstrated problem, assigns ownership, handles failure, and produces a measurable outcome. If the process is unclear or unjustified, automation amplifies confusion. If the process is healthy, automation makes good behavior cheap, repeatable, and boring.

## Tools and Processes Are Not the Strategy

A tool is an implementation choice. A strategy explains what the organization is trying to achieve, why the outcome matters, how work should flow, and which trade-offs are acceptable.

Confusing the two creates predictable disappointment.

Renovate does not create dependency hygiene by itself. It finds updates and proposes changes. A team still needs a policy for patch, minor, and major releases, a pipeline capable of evaluating them, and owners who handle exceptions.

Kubernetes does not create platform maturity by itself. It provides APIs, controllers, scheduling, and a large ecosystem. A company still needs an operating model for ownership, observability, security, capacity, upgrades, incident response, and developer experience.

GitOps does not create clean release management by itself. It reconciles declared state from version control. A team still needs artifact identity, environment promotion, review rules, rollback procedures, and a clear distinction between desired state and runtime health.

CI/CD does not create delivery confidence by itself. A pipeline can be green while testing very little. It can automate a fragile release process faster without making the result safer.

Terraform or OpenTofu does not create Infrastructure as Code discipline by itself. Infrastructure can be declared in code while engineers continue changing production through a cloud dashboard and forget to reconcile the result.

Tools expose the quality of the process around them.

That is why the same technology can be transformative in one organization and exhausting in another. The difference is often not the installation. It is the surrounding system.

Processes deserve exactly the same scrutiny.

A rule is not a strategy merely because it is written in a handbook or enforced by a platform. Mandatory reviews do not automatically improve quality. Release windows do not automatically improve stability. A ticket does not automatically create governance. Push protection does not automatically create safe delivery.

Every new process should begin with a falsifiable problem statement:

```text
We observe X.
It causes Y.
We believe process change Z will improve it.
We will measure A and B for eight weeks.
We will keep, change, or remove the process based on the result.
```

Without that logic, "best practice" often means "a rule we copied without understanding its cost."

## The Push Rules Example

Imagine someone proposes new repository push rules:

- nobody may push directly to `main`
- every change needs two approvals
- all conversations must be resolved
- administrators may not bypass the rules
- every repository receives the same policy

The proposal may be reasonable. It may also be process theater.

"We think strict rules are cool" is not an engineering justification. Neither is "serious companies do this."

Start with the problem. Perhaps direct pushes caused unreviewed production changes. Perhaps a regulatory control requires separation of duties. Perhaps incidents repeatedly involved changes without a second pair of eyes. Those are concrete reasons.

Then design the smallest process that addresses the evidence. A critical payment service may need two reviewers and signed commits. A documentation repository may need one passing check and no mandatory reviewer. An emergency path may need a controlled bypass because preventing recovery during an incident would be worse than allowing an audited exception.

Finally, define success before enabling the rules:

- Did unreviewed production changes decrease?
- Did the change failure rate improve?
- Did review time or lead time become unacceptable?
- How often was the bypass used?
- Did developers split changes into smaller pull requests?
- Did approvals contain useful review or merely "LGTM"?
- Did incidents become easier to trace?

The number of repositories with the rule enabled is an adoption metric. It is not proof that the process improved engineering.

## The Renovate Example

Renovate is a good example because the tool's output is so visible.

The superficial discussion is "Renovate: yes or no?" One team says it keeps dependencies current and saves time. Another says it floods repositories with merge requests and annoys every developer.

Both teams may be describing their real experience.

The meaningful topic is how dependency updates move through the engineering system:

- Are patch updates considered low-risk?
- Can the pipeline evaluate them reliably?
- Should stable patches merge automatically after a cooldown?
- Are minor development dependencies safe to automate?
- Should runtime minor updates be grouped or reviewed individually?
- Are major versions visible and scheduled?
- Who owns an upgrade that remains blocked?
- Can the service be deployed and rolled back safely?

Without answers, Renovate creates undecided work at machine speed. Developers get annoyed, merge requests pile up, and dependency updates slowly rot somewhere on the roadside.

The bot is blamed because it created the visible queue. But the missing policy, weak tests, unreliable CI, and absent ownership existed before the bot arrived.

With a clear process, the experience changes:

- low-risk patches merge after trustworthy checks
- minor updates arrive in a predictable maintenance window
- related packages move together
- major upgrades remain visible without flooding the team
- failures have an owner
- security updates have a defined fast path

Renovate then turns dependency maintenance into a boring background flow.

That is exactly what good engineering automation should do. It should not make maintenance exciting. It should make maintenance routine.

## Automation Amplifies Whatever Already Exists

Automation is an amplifier.

If ownership is unclear, automation creates confusion faster. It generates tasks, alerts, deployments, and failures that still belong to nobody.

If tests are weak, automation creates fear. Every automated change becomes a possible incident because the feedback system cannot distinguish safe behavior from broken behavior.

If releases depend on undocumented manual steps, adding a deployment pipeline often creates more half-finished work. Some steps happen automatically, others remain in personal notes, and nobody knows which system is authoritative.

If environments already drift, automating independent changes in each environment can make the drift grow faster.

If approval rules are vague, automation moves work to queues where it waits indefinitely.

This is why "automate everything" is bad advice. Automation is not inherently positive. Its value depends on what it repeats.

When the process is healthy, the same amplification becomes powerful:

- clear ownership becomes fast routing
- reliable tests become safe automerge
- explicit release criteria become predictable promotion
- good defaults become consistent environments
- useful observability becomes fast diagnosis
- documented recovery becomes automated rollback

Good automation makes the right path the easiest path.

The plus sign in **Speed = Process + Automation** matters. Automation does not replace process. A useful process without automation remains expensive and inconsistent. Automation without a useful process becomes automated confusion. A bad process with excellent automation becomes efficiently enforced friction. Only the right combination creates leverage.

## Design the Process, Then Automate It

Before automating a flow, a team should be able to justify and explain it.

For software delivery, that means answering questions such as:

- How does code move from development to production?
- What is the authoritative code branch?
- Which artifact is promoted between environments?
- What must happen before release?
- Which changes need human review?
- Which decisions are deterministic enough to automate?
- Who owns the application, platform, pipeline, and runtime?
- Which signals are trusted?
- What happens when a check fails?
- How is a deployment rolled back?
- What is the emergency path?
- Which current metric establishes the baseline?
- Which measurable outcome should improve?
- When will the team review whether the process worked?

The process does not need to be perfect before automation begins. In fact, implementing automation often reveals missing steps and contradictory assumptions. But the team needs a target flow, a reason for introducing it, and evidence that can later confirm or reject the decision.

Otherwise, it automates whatever people happen to do today, including accidental complexity.

Consider a manual deployment with 27 steps in a wiki. The immediate temptation is to convert every step into pipeline code. A better first question is why 27 steps exist.

Perhaps:

- eight are repeated validation that CI should already perform
- five compensate for mutable artifacts
- four exist because environments have different source histories
- three are approval steps asking the same question
- two handle configuration that should be declarative
- one is an obsolete workaround

Automating all 27 steps preserves the dysfunction. Redesigning the flow may leave seven useful steps worth automating.

Process design removes unnecessary work. Automation reduces the cost of necessary work. Measurement tells us whether either intervention helped.

## Integration into the System Landscape

Tools and process changes must be evaluated by how they integrate into the larger operating model.

A feature list tells us what a product can do. It does not tell us whether the product improves the system.

### Dependency Automation

A dependency bot must fit into:

- CI and testing
- security and license scanning
- repository ownership
- release strategy
- maintenance capacity
- artifact production
- deployment and rollback

The bot's merge request is only one transition in the flow. If the stages after it are unreliable, automating the first stage creates limited value.

### GitOps

A GitOps controller must fit into:

- environment structure
- artifact promotion
- secret management
- pull-request review
- auditability
- drift policy
- runtime observability
- rollback and break-glass procedures

Installing Flux does not answer whether a change should move from test to production. It provides a strong mechanism for reconciling the decision once that decision is represented clearly.

### Kubernetes

Kubernetes must fit into:

- developer workflows
- platform ownership
- observability
- debugging
- networking
- resource management
- identity and access
- cluster lifecycle
- incident response

A technically impressive cluster that application teams cannot understand or operate may reduce organizational speed.

### Infrastructure as Code

Terraform or OpenTofu must fit into:

- state management
- review and approval
- module ownership
- policy checks
- drift detection
- cloud permissions
- change scheduling
- recovery

Writing HCL is the easy part. Establishing a trustworthy path from a pull request to a controlled infrastructure change is the engineering system.

The value of a tool is not only in its feature list. The value of a process is not in how strict or fashionable it sounds. Their value comes from the role they play within the operating model and the outcome they improve.

## Speed Without Sloppiness

Speed is often misunderstood as "move fast and click things."

That is activity, not flow.

A team can deploy ten times a day while spending most of its time resolving flaky tests, coordinating handovers, chasing configuration drift, and recovering from preventable mistakes. The deployment count looks fast. The system feels slow.

Real speed means:

- fewer manual decisions
- fewer unclear handovers
- fewer special cases
- fewer hidden dependencies
- smaller changes
- faster trustworthy feedback
- predictable recovery
- less waiting for privileged individuals

A fast system is boring in the best possible way.

Developers know how a change reaches production. The default pipeline handles ordinary work. Checks fail for understandable reasons. Environments receive immutable artifacts. Dashboards show useful state. Rollback follows an exercised path. Exceptions are visible because everything is not an exception.

This is what the formula points to:

> Speed is not randomness. Speed is engineered flow.

Teams move quickly when they do not need to renegotiate the delivery process for every change.

## Humans Should Handle Exceptions, Not Repetition

Humans are expensive, inconsistent, creative, and valuable.

That combination makes us excellent at architecture, trade-offs, diagnosis, prioritization, and decisions involving incomplete information. It makes us a poor choice for repetitive deterministic work.

Developers should not spend attention:

- approving routine patch updates after green checks
- copying the same deployment commands
- synchronizing configuration by hand
- recreating release notes from commit history
- comparing environments to guess what changed
- checking dashboards on a fixed schedule when a machine can alert on exceptions

Humans should focus on:

- major dependency migrations
- architecture decisions
- security trade-offs
- ambiguous failures
- incident response
- capacity planning
- product risk
- changes with real business consequences

This is not about removing humans from engineering. It is about using human judgment where it matters.

An approval step is valuable when the approver contributes context or accepts risk. It is waste when the person merely confirms that five automated checks are green.

Good automation handles repetitive, deterministic, low-risk work and escalates exceptions with enough context for a human to act.

## Ownership Boundaries Create or Destroy Speed

Many tool problems are ownership problems wearing technical clothing.

A pipeline fails, but the application team thinks the platform team owns it. The platform team says the failure comes from application tests. A dependency update sits open because nobody knows whether security, developers, or SRE should review it. A GitOps reconciliation fails because the repository and cluster belong to different groups with different priorities.

Automation crossing unclear boundaries does not create collaboration. It creates faster ticket generation.

A healthy operating model defines:

- who owns the source
- who owns the delivery path
- who owns the platform capability
- who responds to runtime failure
- where responsibility changes hands
- what information crosses the boundary

Boundaries are not automatically silos. Good boundaries reduce ambiguity. They allow teams to act independently while understanding where coordination is required.

The best automation respects these boundaries. It routes failures to the right owner, exposes relevant context, and avoids requiring central teams to approve every ordinary action.

## Feedback Loops Determine Delivery Speed

Automation without feedback is merely remote execution.

A useful engineering system answers:

- Did the change pass validation?
- Was the artifact built correctly?
- Was it deployed?
- Did the desired state reconcile?
- Is the service healthy?
- Did customer behavior change?
- Can the system recover?

The faster and more trustworthy these answers are, the smaller the batch of work a team can process safely.

Slow feedback encourages large changes. If integration tests take six hours and staging deployment requires two days of coordination, teams naturally group work together. Large batches then become harder to review, test, release, and roll back.

Fast feedback supports small changes. Small changes are easier to understand. That makes automation safer, which makes feedback faster again.

This reinforcing loop is one of the main sources of sustainable engineering speed.

## Measure the Outcome or Admit It Is a Preference

Introducing a tool or process without defining success is not engineering. It is preference backed by authority.

Measurement should begin before rollout. If the team introduces push rules to reduce unsafe changes but never records the current change failure rate, number of unreviewed changes, review time, or incident traceability, it cannot later prove that the rules helped.

A useful change proposal contains:

1. **A concrete problem.** What is happening today, and why does it matter?
2. **A baseline.** How often does it happen, how much time does it consume, or which risk does it create?
3. **A hypothesis.** Which behavior should the tool or process change?
4. **A target outcome.** What measurable improvement do we expect?
5. **Guardrail metrics.** Which other outcomes must not become worse?
6. **A review date.** When will we evaluate the result?
7. **A decision rule.** Under which evidence will we keep, modify, or remove the change?

For new push rules, the target might be fewer unreviewed production changes. Guardrails might include pull-request lead time, emergency bypass frequency, and developer waiting time. A process that reduces one incident class but triples delivery time may still be the wrong design.

For Renovate, success is not the number of merge requests created. Better measures include dependency age, time to merge low-risk updates, number of stale updates, pipeline failure causes, and time spent on manual maintenance.

For a developer platform, success is not the number of services onboarded. Measure whether service creation became faster, whether teams need fewer tickets, whether production changes became safer, and whether developers can diagnose failures without waiting for the platform team.

Metrics need context. Lead time, deployment frequency, change failure rate, recovery time, queue length, toil, and developer feedback can all be useful. None should become a target detached from the problem.

Adoption proves that a mechanism was deployed. It does not prove that the system improved.

## Bad Processes and Automation Create Work

Bad automation can be worse than no automation because it produces work while claiming to remove it. The same is true of a bad process: it adds waiting, handovers, and approvals while claiming to create control.

### Rules Without a Demonstrated Problem

A team introduces mandatory approvals, restricted push windows, and another release checklist because the rules look mature. Nobody defines which failure they prevent or measures whether they improve it. Engineers comply, delivery slows, and the process survives because removing it feels risky.

### Renovate Without Policy

Renovate opens dozens of merge requests. There are no schedules, groups, concurrency limits, or ownership rules. Developers spend more time managing the queue than maintaining dependencies.

### Flaky CI

A pipeline runs 40 jobs, takes an hour, and fails randomly. Engineers rerun it until it passes. The automation adds waiting and destroys confidence.

### Opaque Deployment Automation

A deployment tool hides state behind a friendly button. When it fails, nobody knows which command ran, which artifact was selected, or which part of the environment changed.

### Misplaced Abstraction

An internal platform wraps a simple vendor API in several layers of templates and custom configuration. Developers now need to understand both the abstraction and the underlying service when something breaks.

### Ticket Automation

A self-service form creates a ticket for a platform team instead of providing a capability. The request looks automated to the user, but the work has merely moved behind the interface.

Bad automation does not create speed. It creates automated frustration.

Bad process does not create safety. It creates procedural friction.

Both give the illusion of progress while quietly moving work somewhere else.

## Good Automation Creates Flow

Good automation has recognizable properties.

### It Is Understandable

The team can explain what triggers it, what it changes, and which conditions control the result. The implementation may be complex, but the operating model is clear.

### It Is Observable

People can see current state, progress, failures, and outcomes. Logs contain useful context. Metrics show whether the automation improves the process.

### It Has Clear Ownership

Someone maintains it. Failures reach an owner. Users know where to ask questions and how to escalate.

### It Fails Loudly and Usefully

A useful failure explains what happened and what action is required. Silent partial success is one of the most dangerous forms of automation.

### It Removes Repetitive Work

The automation reduces actual effort instead of generating a different manual queue.

### It Supports the Real Process

It models how the organization intends to work. It does not pretend approvals, environment differences, security boundaries, or recovery needs do not exist.

### It Creates Guardrails

Safe behavior becomes easy. Unsafe behavior becomes difficult, visible, or explicitly exceptional.

### It Is Reversible

The team understands how to stop, roll back, or bypass it safely when assumptions fail.

Good automation turns important engineering hygiene into something boring and reliable.

## Platform Engineering Is Process Productization

Platform engineering is often described through portals, Kubernetes operators, templates, and developer platforms. The more important idea is productizing a good process.

A platform should encode a path that the organization trusts:

```text
Create service
    ↓
Build and test
    ↓
Produce immutable artifact
    ↓
Deploy with standard controls
    ↓
Observe runtime behavior
    ↓
Recover predictably
```

The platform makes this path available repeatedly without forcing every team to rebuild it.

If the underlying process is poor, a portal only gives the poor process a better interface. If the process is clear and automation is reliable, the platform becomes leverage across the organization.

This is another expression of the same formula. The platform is not the source of speed by itself. It packages process and automation into a consumable product.

## Practical Questions Before Introducing a Tool or Process

Before adding a tool, rule, gate, policy, or workflow, ask:

1. **What problem are we solving?**
   Describe the current pain in operational terms, not as the absence of a product or process.

2. **What evidence shows that the problem exists?**
   Establish a baseline before changing the system.

3. **Which process will this change support or modify?**
   Identify the current and desired flow before choosing an implementation.

4. **What is the simplest intervention that might work?**
   Do not introduce a platform when one clear rule would solve the problem.

5. **How easy will the process be to follow and automate?**
   A process requiring constant reminders and exceptions is unlikely to scale.

6. **What behavior should become easier?**
   The change should make a desirable path cheaper or safer.

7. **Who owns the result?**
   Installation ownership is not enough. Who operates it and handles failures?

8. **What will be automated?**
   Be explicit about triggers, decisions, actions, and state changes.

9. **What still needs human judgment?**
   Keep decisions involving risk, ambiguity, and business context visible.

10. **What happens when it fails?**
   Define detection, escalation, recovery, and bypass behavior.

11. **How does it integrate with CI, deployment, observability, and security?**
   A local improvement can create system-level friction.

12. **Which source of truth does it use?**
   Avoid creating another place where state can diverge.

13. **Will this reduce work or move work somewhere else?**
    Count the new queues, approvals, maintenance, and operational load.

14. **Can developers understand and operate it?**
    A tool or process understood only by specialists may create a new bottleneck.

15. **How will we measure success?**
    Define the outcome, target, guardrails, and review period before rollout.

16. **What will make us change or remove it?**
    A process without an exit criterion tends to survive long after its value disappears.

If the team cannot answer these questions, it may not be ready to introduce the tool or process. "We like it" is a preference. "Everyone else uses it" is social proof. Neither is an engineering case.

## Applying the Formula in Practice

The formula can be used as a simple review method.

### Step 1: Define the Problem and Baseline

Map the real flow, including manual steps, waiting, exceptions, handovers, and failure recovery. Record how the current problem affects lead time, failure, toil, risk, or another relevant outcome.

### Step 2: Form a Measurable Hypothesis

State which process or tool change should improve which outcome, by how much, and without damaging which guardrails.

### Step 3: Remove Unnecessary Complexity

Question approvals, branches, environment differences, custom scripts, repeated data entry, and duplicated controls.

### Step 4: Define Ownership and Evidence

Decide who owns each transition and which signals prove that it succeeded.

### Step 5: Automate Deterministic Work

Automate builds, tests, validation, promotion, reconciliation, notification, and routine maintenance where decisions are clear.

### Step 6: Preserve Human Decision Points

Keep humans involved for major risk, architectural choice, incident judgment, and business approval.

### Step 7: Measure the Outcome

Compare the result with the baseline. Measure whether the tool and process reduce lead time, failure, waiting, or toil without creating unacceptable side effects.

### Step 8: Keep, Change, or Remove

Do not declare success because rollout finished. Keep what works, simplify what does not, and remove controls whose cost exceeds their demonstrated value.

Process and automation evolve together. "Process first" does not mean designing a perfect process in a meeting and freezing it forever. It means process starts with a problem and hypothesis, automation follows intent, and measured feedback improves both.

## Conclusion

Tools matter. Processes matter. A capable tool can remove enormous amounts of work, and a well-designed process can create useful guarantees and enable operating models that would otherwise be impractical.

But neither tools nor processes are magic.

A good tool in a bad process becomes noise. A bad process enforced by good tooling becomes scalable bureaucracy. A good process with thoughtful automation becomes leverage.

That is why I return to the same formula:

> **Speed = Process + Automation**

The process defines how value should flow, where responsibility lives, which evidence is trusted, and how failure is handled. Measurement proves whether the process improves the system. Automation makes the validated flow cheap, consistent, observable, and repeatable.

The goal is not to collect tools, copy fashionable processes, or automate the largest possible number of steps. It is to build a system where good engineering happens naturally, repeatedly, measurably, and with less friction.

Real engineering speed is not created by buying another tool or imposing another rule. It is created by solving a real problem with the simplest effective process, automating that process well, and measuring whether the result actually improved.
