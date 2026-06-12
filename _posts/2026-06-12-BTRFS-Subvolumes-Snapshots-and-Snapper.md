---
title: "BTRFS, Subvolumes, Snapshots, and Snapper"
description: "What BTRFS is good at, how to structure it with subvolumes, and how snapshots with Snapper make system changes much less stressful."
layout: post
date: 2026-06-12 15:30:00 +0200
tags: [Linux, Filesystems]
---

Most Linux installations still treat the filesystem as an afterthought.

You make one root partition, maybe one home partition, format everything as `ext4`, and move on. That works. But once you start doing frequent package upgrades, distro experiments, workstation tuning, or homelab maintenance, the lack of cheap snapshots becomes very noticeable.

This is where BTRFS becomes practical.

<!-- more -->

Not because it is exotic, and not because every feature in its marketing list matters equally, but because it gives you a much better operating model for a Linux system:

- subvolumes instead of one giant undifferentiated root filesystem
- cheap snapshots before risky changes
- transparent compression
- send/receive for replication
- a cleaner rollback story with tools like `snapper`

For a workstation, laptop, or small server, that is often a very good trade.

## What BTRFS Actually Is

BTRFS is a copy-on-write filesystem for Linux.

The copy-on-write part is the important bit.

On a traditional overwrite-in-place model, changing a file means the filesystem updates the existing blocks directly. The old state is simply gone once the write completes.

BTRFS behaves differently. When data changes, it writes the modified version to new blocks first and only then updates the metadata to point at the new location. The old blocks remain intact until they are no longer referenced.

That sounds abstract, but operationally it means three very useful things:

- taking a snapshot does not require duplicating the whole filesystem up front
- the old state and the new state can coexist cheaply
- rollbacks and point-in-time views become natural filesystem features instead of awkward external hacks

That design is the reason snapshots feel so lightweight on BTRFS. You are not cloning an entire partition every time. You are preserving references to an earlier state and only paying extra space as data diverges over time.

In practice, the features most people actually care about are:

- snapshots
- subvolumes
- compression
- checksumming
- incremental replication via `btrfs send` / `btrfs receive`

There are other features too, but if you are setting it up for a normal Linux machine, those are the ones that usually justify the decision.

## Why Subvolumes Matter

The first conceptual mistake people make with BTRFS is treating it like `ext4` with extra commands.

That misses the point.

You usually do not want one single root filesystem where everything lives together forever. You want some structure. BTRFS subvolumes let you split the system into logical pieces without needing a pile of separate partitions.

That matters because not all data behaves the same:

- `/` should be snapshot-friendly
- `/home` should often be separate from root snapshots
- `/var/log` changes constantly and is usually not something you want duplicated in every system snapshot
- `/var/cache` is often disposable
- `/.snapshots` should have its own place

So instead of partitioning everything into rigid blocks, you create multiple subvolumes inside one BTRFS filesystem and mount them where they belong.

## A Practical Subvolume Layout

For a normal machine, I like a layout roughly like this:

```text
@
@home
@var_log
@var_cache
@snapshots
```

Mapped like this:

- `@` -> `/`
- `@home` -> `/home`
- `@var_log` -> `/var/log`
- `@var_cache` -> `/var/cache`
- `@snapshots` -> `/.snapshots`

This gives you a sane default:

- system snapshots focus mainly on the operating system
- logs and caches do not bloat every snapshot
- home data can be managed separately
- Snapper has a dedicated place for snapshot data

You can split more aggressively if you want, for example separate subvolumes for container storage, virtual machine images, or databases. But for many systems, the layout above is already enough.

## Setting Up BTRFS with Multiple Subvolumes

Assume your root partition is `/dev/nvme0n1p2`.

First create the filesystem:

```shell
mkfs.btrfs -L system /dev/nvme0n1p2
```

Then mount it temporarily and create the subvolumes:

```shell
mount /dev/nvme0n1p2 /mnt

btrfs subvolume create /mnt/@
btrfs subvolume create /mnt/@home
btrfs subvolume create /mnt/@var_log
btrfs subvolume create /mnt/@var_cache
btrfs subvolume create /mnt/@snapshots

umount /mnt
```

Now mount the root subvolume and create the mount points for the others:

```shell
mount -o subvol=@,compress=zstd,noatime /dev/nvme0n1p2 /mnt

mkdir -p /mnt/home
mkdir -p /mnt/var/log
mkdir -p /mnt/var/cache
mkdir -p /mnt/.snapshots
```

Then mount the remaining subvolumes:

```shell
mount -o subvol=@home,compress=zstd,noatime /dev/nvme0n1p2 /mnt/home
mount -o subvol=@var_log,compress=zstd,noatime /dev/nvme0n1p2 /mnt/var/log
mount -o subvol=@var_cache,compress=zstd,noatime /dev/nvme0n1p2 /mnt/var/cache
mount -o subvol=@snapshots,compress=zstd,noatime /dev/nvme0n1p2 /mnt/.snapshots
```

That gives you the basic layout before installation or before copying an existing system into place.

## Example `fstab`

Once the system is installed, the `fstab` can look like this:

```fstab
UUID=11111111-2222-3333-4444-555555555555  /            btrfs  subvol=@,compress=zstd,noatime  0 0
UUID=11111111-2222-3333-4444-555555555555  /home        btrfs  subvol=@home,compress=zstd,noatime  0 0
UUID=11111111-2222-3333-4444-555555555555  /var/log     btrfs  subvol=@var_log,compress=zstd,noatime  0 0
UUID=11111111-2222-3333-4444-555555555555  /var/cache   btrfs  subvol=@var_cache,compress=zstd,noatime  0 0
UUID=11111111-2222-3333-4444-555555555555  /.snapshots  btrfs  subvol=@snapshots,compress=zstd,noatime  0 0
```

I usually enable `compress=zstd` unless I have a specific reason not to. For many Linux workloads, transparent compression is basically free space efficiency.

## Why This Layout Is Better Than One Big Root Filesystem

Because snapshots become useful instead of noisy.

If you snapshot a giant root filesystem containing logs, caches, package downloads, browser junk, containers, and everything else, your snapshots become much less meaningful. They still work, but they are messier and tend to grow in unhelpful ways.

Subvolumes let you decide what belongs in the rollback boundary.

That is the real value.

If I snapshot `/` before a risky update, I want a snapshot of the operating system state. I do not particularly care whether a transient cache file from two minutes ago also got preserved.

## How Snapshots Work

A BTRFS snapshot is effectively a copy-on-write view of a subvolume at a point in time.

That is why snapshots are cheap to create. The snapshot does not immediately duplicate all data blocks. Initially, the old and new views mostly share the same data. Only later changes start consuming extra space.

There are two snapshot modes you will see most often:

- read-only snapshots
- read-write snapshots

Read-only snapshots are ideal for history, rollback references, and replication.
Read-write snapshots are useful when you want to branch off and actually modify the snapshot contents.

For example:

```shell
btrfs subvolume snapshot -r / /.snapshots/root-pre-upgrade
btrfs subvolume snapshot /home /.snapshots/home-test
```

The first creates a read-only snapshot of `/`.
The second creates a writable snapshot of `/home`.

This is the core reason BTRFS changes the day-to-day admin experience. You can snapshot before dangerous changes without feeling like you are doing a full backup every time.

## Snapshots Are Not Backups

This needs to be said explicitly.

Snapshots protect you from logical mistakes on the same filesystem:

- a bad package upgrade
- deleting the wrong files
- a broken config rollout
- a system state you want to revert

Snapshots do **not** protect you from:

- disk failure
- controller failure
- theft
- fire
- filesystem corruption that destroys the whole device

Snapshots are local recovery points, not a replacement for external backups.

If you want real backups with BTRFS, the natural next step is `btrfs send` / `btrfs receive` to another disk or another machine.

## Is BTRFS Good for RAID?

This is the part where people often want a clean yes or no, but the honest answer is more conditional.

For single-disk systems, small mirrored systems, and homelab-style setups, BTRFS can be very attractive because it combines filesystem features and multi-device awareness in one stack.

For RAID, the question is not "does BTRFS support it?" The question is "which RAID profile, for which workload, and how conservative do you want to be?"

### Where BTRFS is attractive

BTRFS is very reasonable on:

- single-disk systems
- RAID1-style mirrored setups
- small Linux servers where snapshots and checksumming are valuable
- systems where you want `btrfs scrub`, snapshots, and send/receive in one native workflow

Mirroring is where BTRFS tends to make the most intuitive sense. You get redundancy plus the normal BTRFS benefits without adding a lot of conceptual complexity.

### Where you should be more careful

I would be much more cautious with parity-style RAID profiles.

The reason is simple: once you move from mirroring to parity, failure handling, rebuild behavior, and edge cases become more sensitive. Filesystems with integrated RAID features have to get a lot of details right under degraded or interrupted conditions, and this is not the area where I would choose the most adventurous option just because it looks elegant on paper.

So my practical view is:

- BTRFS on one disk: good
- BTRFS on mirrored disks: often good
- BTRFS on parity RAID: only if you know exactly why you want it and are willing to own the operational risk

That is not fearmongering. It is just the wrong place to be casual.

### Why mirrors fit the BTRFS model better

If your main reasons for using BTRFS are snapshots, checksumming, compression, and clean system rollback, then mirroring complements that very well.

You get:

- redundancy against a disk failure
- data integrity features
- cheap snapshots
- a coherent admin model

That is a strong combination for workstations, NAS-like homelabs, and small servers.

### Why RAID does not replace backups either

It is also worth repeating that RAID and snapshots solve different problems.

RAID helps with device failure.
Snapshots help with logical mistakes and rollback.
Backups help with catastrophic loss and external recovery.

You usually want to think in those three layers, not pick one and pretend it covers the others.

### My practical recommendation

If you want BTRFS and you also want redundancy, mirrored layouts are the sane default.

If you mainly want large-capacity parity storage, I would evaluate that much more conservatively and make sure the operational model, monitoring, recovery procedure, and backup strategy are all very explicit before committing to it.

In other words: BTRFS is very good at improving the day-to-day behavior of Linux systems. That does not automatically mean every possible RAID layout is equally attractive.

## Setting Up Snapper

Snapper is one of the nicest ways to operationalize BTRFS snapshots.

Instead of manually naming and managing every snapshot, Snapper gives you:

- named configs
- timeline snapshots
- pre/post snapshots around changes
- cleanup policies
- diff views between snapshots
- rollback workflows

Install the tooling for your distribution, typically at least:

```shell
btrfs-progs
snapper
```

The exact package names and optional integrations differ by distro, but that is the base.

If `/.snapshots` is mounted as its own BTRFS subvolume, creating a root config is straightforward:

```shell
snapper -c root create-config /
```

Then verify what it created:

```shell
snapper -c root list
snapper -c root get-config
```

That gives you a managed snapshot configuration for the root filesystem.

You can also create a separate config for `/home` if that fits your workflow better:

```shell
snapper -c home create-config /home
```

Whether you want snapshots for `/home` is a matter of taste. For some people it is very useful. For others, user data is better handled through normal backups and sync tools rather than frequent local snapshots.

## A Sensible Snapper Workflow

Once Snapper is in place, a practical workflow looks like this:

Before a risky change:

```shell
snapper -c root create -d "before major system update"
```

Then do your package upgrade, configuration rewrite, kernel change, or whatever else might go sideways.

Afterwards, inspect snapshots:

```shell
snapper -c root list
```

Compare files between snapshots:

```shell
snapper -c root status 10..11
snapper -c root diff 10..11
```

That alone is already useful. It turns “something changed” into something inspectable.

## Pre/Post Snapshots Around Package Operations

One very nice pattern is creating a snapshot before and after package transactions.

That way you can see exactly what changed across a system update and roll back more confidently if necessary.

Some distributions integrate this more tightly than others, but even without deep package manager integration, the operating model is still worthwhile:

- create a pre-change snapshot
- perform the upgrade
- create or inspect the post-change state
- keep a short retention policy for older snapshots

This is especially valuable on rolling-release systems or machines where you make frequent low-level changes.

## Rollbacks

The exact rollback flow depends a bit on your distro and bootloader setup, so this is the part where you should not pretend there is only one universal command sequence.

Conceptually, though, rollback means one of two things:

- boot or mount an older snapshot to inspect or recover files
- promote a known-good snapshot back into active service

A common manual pattern is:

```shell
snapper -c root list
```

Pick the snapshot you trust, then create a writable snapshot from it:

```shell
btrfs subvolume snapshot /.snapshots/123/snapshot /.snapshots/123-restored
```

After that, you can either copy data out of it, or adjust your boot and mount layout so that the restored snapshot becomes the active root.

This part is intentionally distro-sensitive. openSUSE, for example, tends to offer a more integrated rollback experience than a hand-rolled Arch or Gentoo installation. The underlying filesystem capability is the same; the amount of automation around it is not.

## Compression, Deduplication, and the Other Nice Extras

Snapshots are the headline feature, but they are not the only reason to use BTRFS.

Transparent compression with `zstd` is often a very good default. Many text-heavy or package-heavy Linux systems save a meaningful amount of space with very little downside.

Deduplication also exists in the broader BTRFS ecosystem, but I would treat it as a bonus feature, not the main argument. If snapshots, subvolumes, and compression already solve your problem, that is enough reason.

## Where BTRFS Makes the Most Sense

I think BTRFS is especially compelling for:

- Linux workstations
- developer laptops
- homelab machines
- small servers where system snapshots are operationally useful
- rolling-release systems

It is less about chasing every advanced feature and more about getting a better failure model for normal maintenance.

If you regularly touch kernels, bootloaders, package sets, containers, or system-wide configuration, snapshots are not a luxury. They are a quality-of-life feature.

## Closing Thoughts

The best reason to use BTRFS is not that it has a long feature list.

It is that it lets you structure a Linux system more intelligently and recover from change more calmly.

Multiple subvolumes give you clean boundaries.
Snapshots give you cheap restore points.
Snapper gives you a usable workflow on top of them.

That combination is what makes BTRFS worth using.
