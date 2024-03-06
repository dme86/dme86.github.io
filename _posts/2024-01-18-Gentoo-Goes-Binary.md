---
title: Gentoo goes Binary
layout: post
tags: [Linux, Gentoo]
---

I was genuinely excited as I read the latest Gentoo news regarding their commitment to [providing more binary packages](https://www.gentoo.org/news/2023/12/29/Gentoo-binary.html) for Gentoo stable.

Gentoo is often referred to as **the** non-binary distribution, where everything must be compiled from source code. For me, this aspect has always been Gentoo's greatest strength and, simultaneously, its most significant weakness. Despite being a fervent Gentoo fan, I find myself resorting to [Arch](https://archlinux.org/) in certain environments because, I must admit, compile times on Gentoo, especially on older hardware, can be quite painful.

This is precisely why Gentoo is now expanding its offering of binary packages on their (mirror) servers. While, for most architectures, this is limited to the core system and weekly updates, it's a different story for **amd64 and arm64**. There, they boast an impressive **>20 GByte of packages** on their mirrors, ranging from LibreOffice to KDE Plasma and from Gnome to Docker. Gentoo stable is updated daily!

<!-- more -->

Despite the newfound convenience, you still retain the flexibility of Gentoo's USE flags. However, if you find yourself running Gentoo on older hardware or simply wish to avoid lengthy builds, such as with qtwebengine, you have the option to expedite the installation process using binaries on a base system. Later, you can switch back to a non-binary installation, although the installation process with binaries is considerably faster, as illustrated in the screenshot I captured during a fresh installation using [emerge](https://wiki.gentoo.org/wiki/Emerge), which predominantly utilized binary packages:
![enter image description here](https://i.imgur.com/QtjKALZ.png)

> I'm using a [modded version of dwm](https://github.com/dme86/dwm) as my windowmanager and [st](https://github.com/dme86/st) as my terminal emulator.

The only modifications I made in this fresh installation were to edit the contents of this new file here:

    /etc/portage/binrepos.conf/gentoobinhost.conf

So that the priority is **9999** and to ensure I'm utilizing the nearest mirror:

    [gentoobinhost]
    priority = 9999
    sync-uri = https://mirror.netcologne.de/gentoo/releases/amd64/binpackages/17.1/x86-64/

Also, **make.conf** should have the following entry to enforce verification of GPG signatures:

    FEATURES="${FEATURES} binpkg-request-signature"

`emerge -avuDUg @world` will now handle the rest.

If you wish to install a package like [neovim](https://github.com/dme86/neovim) using emerge, you can do so by employing the "-g" parameter alongside the emerge command to install neovim from the binaries:

    emerge -g --ask neovim

If you desire to set the "-g" parameter as the default for your system, modify your make.conf file to ensure that [EMERGE_DEFAULT_OPTS](https://wiki.gentoo.org/wiki/EMERGE_DEFAULT_OPTS/en) reflects your preferred default settings:

    EMERGE_DEFAULT_OPTS="-g"


# Installation in an virtual environment


If I have to set up a virtual machine, I typically do so using [qemu](https://www.qemu.org/). For me, this is the most versatile and lightweight way to spin up virtual machines.

First, I created a qemu image of 15GB:


    qemu-img create -f qcow2 gentoo.qcow2 15g

For this machine, I created this simple shell startup file:

```shell
    qemu-system-x86_64 \
      -m 2G \
      -vga virtio \
      -display default,show-cursor=on \
      -usb \
      -device usb-tablet \
      -smp 2 \
      -cdrom install.iso -boot menu=on \
      -drive file=gentoo.qcow2,if=virtio \
      -device e1000,netdev=net0 \
      -netdev user,id=net0,hostfwd=tcp::2222-:22  \
      -cpu Nehalem
```

and made it executable via `chmod +x start.sh`.

Now, I downloaded the latest [minimal install image from Gentoo](https://www.gentoo.org/downloads/) and started the VM via `./start.sh`.

After the machine was booted up, I started the SSH daemon, assigned a password to root, and was able to SSH into it from a proper [terminal emulator](https://github.com/dme86/st).

```shell
/etc/init.d/sshd start
passwd root
```
```shell
ssh -p 2222 root@localhost
```

# Gentoo

I did the usual steps for installing Gentoo without any frills. If you don't have any idea of what you are doing, please [read the Gentoo Handbook](https://wiki.gentoo.org/wiki/Handbook:AMD64/en). It's awesome.

```shell
livecd /etc/portage/binrepos.conf # lsblk
NAME  MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
fd0     2:0    1     4K  0 disk
loop0   7:0    0 424.5M  1 loop /mnt/livecd
sr0    11:0    1 466.7M  0 rom  /mnt/cdrom
vda   252:0    0    15G  0 disk
zram0 253:0    0     0B  0 disk
```

```shell
livecd /etc/portage/binrepos.conf # parted /dev/vda
GNU Parted 3.6
Using /dev/vda
Welcome to GNU Parted! Type 'help' to view a list of commands.
(parted) mklabel gpt
(parted) mkpart primary ext4 1MiB 100%
(parted) set 1 boot on
(parted) quit
Information: You may need to update /etc/fstab.
```


```shell
livecd /etc/portage/binrepos.conf # blkid /dev/vda1
/dev/vda1: UUID="2e7bc77b-40ff-46c2-8d13-3f34cf03742a" BLOCK_SIZE="4096" TYPE="ext4" PARTLABEL="primary" PARTUUID="e28d6e8d-bb87-427e-818b-198d60e23ddb"
```

```shell
livecd /etc/portage/binrepos.conf # mount /dev/vda1 /mnt/gentoo/
livecd /etc/portage/binrepos.conf # cd /mnt/gentoo/
livecd /mnt/gentoo # ls
lost+found
livecd /mnt/gentoo # wget https://distfiles.gentoo.org/releases/amd64/autobuilds/20240114T164819Z/stage3-amd64-systemd-mergedusr-20240114T164819Z.tar.xz
--2024-01-18 13:45:33--  https://distfiles.gentoo.org/releases/amd64/autobuilds/20240114T164819Z/stage3-amd64-systemd-mergedusr-20240114T164819Z.tar.xz
Resolving distfiles.gentoo.org... 195.181.170.18, 212.102.56.182, 195.181.175.15, ...
Connecting to distfiles.gentoo.org|195.181.170.18|:443... connected.
HTTP request sent, awaiting response... 200 OK
Length: 309232792 (295M) [application/x-xz]
Saving to: ‘stage3-amd64-systemd-mergedusr-20240114T164819Z.tar.xz’

stage3-amd64-systemd-mergedusr-20240114T164819Z 100%[======================================================================================================>] 294.91M  11.1MB/s    in 29s

2024-01-18 13:46:03 (10.3 MB/s) - ‘stage3-amd64-systemd-mergedusr-20240114T164819Z.tar.xz’ saved [309232792/309232792]

livecd /mnt/gentoo # tar xpvf stage3-*.tar.xz --xattrs-include='*.*' --numeric-owner
```
