---
layout: post
mermaid: true
---


A few years ago, there was considerable discussion surrounding Red Hat's transition of CentOS, which, according to insights shared by industry experts on platforms such as Reddit, was perceived as a shift towards an unstable development-oriented rolling-release model.
It is possible that you encountered similar information and, perhaps, acted upon the advice of professionals who expressed their opinions online.

This narrative reflects the state of CentOS prior to the aforementioned transformation:


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
