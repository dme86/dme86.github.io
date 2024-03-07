---
title: Why I Continue To Advocate For Centos Stream In Production Environments
layout: post
mermaid: true
tags: [Linux, CentOS]
---


A few years ago, there was considerable discussion surrounding Red Hat's transition of CentOS, which, according to insights shared by "industry experts" on platforms such as Reddit, was perceived as a shift towards an unstable development-oriented rolling-release model.
It is possible that you encountered similar information and, perhaps, acted upon the advice of professionals who expressed their opinions online.

This narrative reflects the state of CentOS prior to the aforementioned transformation:

<!-- more -->


<div class="mermaid">
graph LR
classDef sub opacity:0
classDef note fill:#7bf, stroke:#ccb
A{Fedora}
A -->|Enterprise Stabilization| C{RHEL}
C --> D{CentOS}
    subgraph subC [" "]
        C
        noteC[Stable]
    end
class subA,subB,subC sub
class noteA,noteB,noteC note
</div>


Previously, CentOS operated as a community-driven initiative that involved retrieving all the source RPMs from Red Hat Enterprise Linux (RHEL) and crafting a functional distribution from them. The sole alterations were the removal of Red Hat's branding, adhering to legal stipulations.
Essentially, CentOS Linux closely mirrored RHEL, differing only in the absence of proprietary branding, and it did not incorporate its own fixes, modifications, or patches.

What has transformed, aside from the nomenclature shift to "Stream," is this:

<div class="mermaid">
graph LR
classDef sub opacity:0
classDef note fill:#7bf, stroke:#ccb
A{Fedora}
A -->|Enterprise Stabilization| C{CentOS}
C --> D{RHEL}
    subgraph subC [" "]
        C
        noteC[Stable]
    end
class subA,subB,subC sub
class noteA,noteB,noteC note
</div>


> CentOS Stream now occupies the position formerly held by RHEL.
> Therefore, unless one perceived RHEL as unstable, there is no basis to
> assume that CentOS Stream will exhibit instability.

The designation of CentOS Stream as a rolling release prompted some discontent among users. It is important to note that a traditional rolling release does not inherently imply instability; rather, it involves meticulous testing of packages by maintainers.
The distinguishing feature is the potential for significant version jumps in installed packages, leading to notable changes in program behavior.

In the case of CentOS Stream, the alteration primarily involves the elimination of point releases. Instead of transitioning from, for instance, CentOS 7 to 7.1, users receive regular updates.
As these updates remain within the same major release, they do not introduce disruptive changes. This framework contrasts with classic rolling releases such as Arch or Gentoo, which lack version numbers.

For those familiar with Debian Stable and the -updates repository, the concept is analogous.

# Conclusion

RHEL, characterized as a stable LTS distribution, follows a [release schedule](https://access.redhat.com/support/policy/updates/errata) spanning 3 years, complemented by a support period lasting a decade.
Beyond this, minor releases concurrent with a major RHEL release persist for up to 2 years, providing a consistent [ABI](https://en.wikipedia.org/wiki/Application_binary_interface) guarantee that outlines supported interfaces.
This assurance equips developers with precise knowledge about interface stability throughout the 10-year duration.

In comparison, CentOS Stream *maintains its status* as a stable LTS distribution, featuring a release cadence occurring every 3 years and a support lifespan of 5 years.
Aligning with RHEL, CentOS Stream offers an equivalent ABI guarantee.

Traditionally, CentOS adhered to the same cadence and lifespan as the corresponding RHEL release, *excluding* the extended minor release duration.
This distinction is crucial, as CentOS's stability lagged behind RHEL due to users lacking the option to remain on a minor release for 2 years while still receiving security updates.

> This nuance might not be fully grasped by individuals unfamiliar with
> RHEL, including many Reddit users, encompassing a significant portion
> of the CentOS community on the platform.

CentOS Stream, while sharing a stability level with CentOS, does not fall short of CentOS's stability; it is *equally* robust.
Both CentOS and CentOS Stream provide the *same* ABI guarantee and function as a unified major release channel.

For example CentOS Stream 9 was released September 15, 2021 and will have *active Support* until May 31 2027.
