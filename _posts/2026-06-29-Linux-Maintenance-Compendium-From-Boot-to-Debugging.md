---
title: "Linux Maintenance Compendium: From Boot to Debugging"
description: "A practical guide to Linux boot, shells, files, permissions, services, logs, storage, performance, networking, tracing, and systematic debugging."
layout: post
date: 2026-06-29 10:00:00 +0200
tags: [Linux, DevOps, SRE]
excerpt_separator: "<!--more-->"
---

Linux maintenance becomes much easier once you stop seeing the system as one opaque machine and start seeing layers: firmware, bootloader, kernel, init system, filesystems, userspace, shell, services, logs, processes, networking, storage, and permissions. A failure usually belongs to one of those layers, and each layer leaves evidence.

Linux is also unusually discoverable. Most classic tools have a manual page, many commands provide concise `--help` output, and the system exposes a great deal of its own state through logs and virtual filesystems. You do not need to memorize every flag. You need to know where to look, how to read the output, and how to move from one clue to the next.

Read this compendium as a map, not as a giant list to memorize. Start with the layer that best matches the symptom, inspect the evidence, and follow it.

<!--more-->

## Boot Process Overview

A Linux machine starts in stages:

1. The firmware starts first, usually legacy BIOS or UEFI.
2. The firmware finds and runs a bootloader.
3. A bootloader such as GRUB or systemd-boot loads the Linux kernel and usually an initial RAM filesystem, called an initramfs or initrd.
4. The kernel initializes memory management, hardware, drivers, scheduling, and the first temporary root filesystem.
5. Userspace code in the initramfs locates and prepares the real root filesystem. This step is especially important when the root device uses encryption, LVM, software RAID, or a filesystem driver that must be loaded before the real root can be mounted.
6. The system switches from the temporary root to the real root filesystem.
7. The kernel starts process ID 1. On most current general-purpose distributions, PID 1 is systemd.
8. PID 1 starts services and brings the system to its configured operating state.

The real root may use ext4, XFS, Btrfs, ZFS, or another filesystem. The choice affects features and maintenance procedures, but the boot sequence remains broadly similar. For a deeper treatment of subvolumes and snapshots, see [BTRFS, Subvolumes, Snapshots, and Snapper]({% post_url 2026-06-12-BTRFS-Subvolumes-Snapshots-and-Snapper %}).

Once services are running, the machine presents either a display manager and graphical desktop or a terminal login. After authentication, the user normally interacts with the system through a shell.

A useful operational consequence follows from this sequence: an early boot failure should be investigated differently from a failed application. Firmware settings, bootloader configuration, kernel messages, initramfs contents, root-device discovery, and PID 1 each represent a different failure boundary.

## Getting Help: `man`, `--help`, and Built-In Documentation

The habit that scales best on Linux is asking the system before searching the web. Local documentation matches the software actually installed on the machine, including its version and distribution-specific details.

### `man`

`man` opens a manual page:

```shell
man ls
man systemctl
man journalctl
man 5 fstab
```

Manual pages are divided into sections. The most useful ones to recognize are:

- Section 1: user commands
- Section 2: system calls
- Section 3: library functions
- Section 5: file formats and configuration files
- Section 8: system administration commands

`man 5 fstab` explicitly asks for the documentation of the `fstab` file format in section 5. It does not look for an executable named `fstab`. Section numbers also disambiguate names that exist in more than one part of the manual.

Most `man` implementations open pages in a pager that behaves like `less`. These keys are worth learning:

- `j`: move down one line
- `k`: move up one line
- `Space`: move down one page
- `b`: move up one page
- `/pattern`: search forward
- `?pattern`: search backward
- `n`: jump to the next match
- `N`: jump to the previous match
- `g`: jump to the beginning
- `G`: jump to the end
- `q`: quit

The same navigation model appears in many terminal tools, so the investment pays off beyond manual pages.

### `man -k`

When you know the subject but not the command name, search the one-line manual descriptions:

```shell
man -k "copy files"
man -k filesystem
```

This searches the manual-page database. If a newly installed tool does not appear, the database may need to be refreshed by the system administrator with `mandb`.

### `apropos`

`apropos` is normally equivalent to `man -k`:

```shell
apropos "process status"
apropos network
```

Use it to discover tools by concept rather than exact name.

### `whatis`

`whatis` returns the short description for an exact manual-page name:

```shell
whatis ls
whatis fstab
whatis systemctl
```

It is useful when you recognize a name but do not remember its role.

### `--help`

For a quick syntax check, `--help` is often faster than a full manual page:

```shell
ls --help
grep --help
systemctl --help
```

Help quality varies, and a few older tools use different conventions, but `--help` is almost always worth trying. It is particularly effective when you know the command and need to recall one option.

### Shell Builtin `help`

Some commands are implemented by the shell rather than as separate executables. In Bash, `help` documents those builtins:

```shell
help cd
help printf
help jobs
```

Shell builtins can differ from external programs with the same name. The active shell determines their exact behavior.

### `type`

`type` explains how the shell resolves a name:

```shell
type cd
type ls
type -a printf
```

It can reveal a builtin, alias, function, keyword, or external executable. This is invaluable when a command behaves differently from what its manual page suggests.

### `command -v`

`command -v` is a portable way to ask whether and how a command can be invoked:

```shell
command -v ls
command -v python3
command -v kubectl
```

It is generally safer in scripts than parsing the human-oriented output of tools such as `which`.

## What Is a Shell?

A shell is a user-space program that reads commands, performs expansions, starts other programs, connects their input and output, manages pipes and redirections, stores variables, and reports exit codes. It is not the kernel. It does, however, cause kernel system calls constantly, usually through programs and libraries.

Common shells include `sh`, Bash, Zsh, and [fish](https://fishshell.com/). Their interactive features and scripting languages differ. I recommend fish with the [Tide prompt](https://github.com/IlanCosman/tide) for a modern interactive environment: autosuggestions, syntax highlighting, helpful defaults, and a pleasant prompt make routine terminal work easier.

Bash remains important. It is widely installed, dominates existing operational scripts, and is a safer portability target than fish for scripts intended to run on many machines. An excellent interactive shell and a conservative scripting language can coexist.

## The Home Directory and Basic Navigation

A normal user usually owns a home directory at `/home/<user>`. The shell expands `~` to the current user's home, so `~/.ssh` might mean `/home/alice/.ssh`.

An absolute path starts at `/`, such as `/var/log/syslog`. A relative path starts from the current directory, such as `src/main.go`. `.` means the current directory and `..` means its parent.

Names beginning with a dot are hidden from a default directory listing. Common examples include:

- `~/.config`: application configuration
- `~/.ssh`: SSH keys and configuration; permissions matter here
- `~/.local`: user-local programs and data
- `~/.cache`: disposable application caches

“Hidden” is only a display convention. Dotfiles receive no special security protection.

### `pwd`

`pwd` prints the current working directory:

```shell
pwd
```

Use it before a destructive operation if there is any ambiguity about where you are. Relative paths are interpreted from this directory.

### `cd`

`cd` changes the shell's working directory:

```shell
cd /var/log
cd ..
cd ~
cd -
```

`cd -` switches to the previous directory. Because changing directory must affect the current shell process, `cd` is normally a shell builtin rather than an external program.

### `ls`

`ls` lists directory entries:

```shell
ls
ls -la
ls -lh /var/log
ls -ltr
```

`-l` adds metadata, `-a` includes hidden names, `-h` makes sizes readable, and `-t` sorts by modification time. Do not parse `ls` output in serious scripts; filenames can contain spaces, newlines, and other surprising characters.

### `lsd`

[lsd](https://github.com/lsd-rs/lsd) is my preferred modern replacement for `ls`:

```shell
lsd
lsd -la
lsd --tree --depth 2
```

It adds clearer colors, icons when configured with a suitable font, tree views, and convenient defaults. It is not required to understand Linux, and knowing standard `ls` remains essential on remote or minimal systems. For daily interactive use, however, `lsd` makes navigation more pleasant.

## Basic Files and Directories

### `mkdir`

`mkdir` creates directories:

```shell
mkdir reports
mkdir -p projects/demo/src
mkdir -m 700 private
```

`-p` creates missing parents and does not fail if the target already exists. `-m` sets permissions at creation time, though the process umask still matters when no explicit mode is supplied.

### `touch`

`touch` updates file timestamps and creates an empty file if it does not exist:

```shell
touch notes.txt
touch -d "2026-06-01 12:00" marker
```

It is useful for placeholders, timestamp-based workflows, and testing jobs that react to modification times. It is not an editor and does not add content.

### `cp`

`cp` copies files and directories:

```shell
cp config.yml config.yml.bak
cp -a application/ application-backup/
cp -i important.conf /tmp/
```

`-a` preserves most metadata and copies recursively. `-i` asks before overwriting, but interactive safety flags should not be the only protection around important data. Check source and destination carefully, especially when copying into an existing directory.

### `mv`

`mv` moves or renames paths:

```shell
mv old-name.txt new-name.txt
mv build.tar.gz /srv/releases/
mv -i config.new config
```

Within one filesystem a move is often a metadata operation and therefore fast. Across filesystems it becomes a copy followed by removal. By default, an existing destination may be replaced.

### `rm`

`rm` removes directory entries:

```shell
rm obsolete.txt
rm -r old-directory/
rm -i important.txt
```

There is usually no trash or undo at this level. `-r` descends recursively and `-f` suppresses prompts and many errors. The combination `rm -rf` is appropriate in controlled automation but dangerous at an interactive prompt: an empty variable, misplaced space, wrong working directory, or unexpected glob can turn cleanup into data loss. Inspect the expanded target first and quote variables in scripts.

### `rmdir`

`rmdir` removes empty directories:

```shell
rmdir empty-directory
rmdir -p empty/parent/path
```

Its refusal to remove non-empty directories is a useful safety property. Use it when recursive deletion is unnecessary.

### `tree`

`tree` presents a directory hierarchy:

```shell
tree
tree -a -L 2
tree -d /etc
```

It is useful for understanding an unfamiliar project or configuration layout. `-L` limits depth, which prevents a large tree from overwhelming the terminal.

## Reading and Inspecting Files

### `cat`

`cat` writes one or more files to standard output:

```shell
cat /etc/os-release
cat part-1.txt part-2.txt
```

It is ideal for short files and pipelines. For a large file, use `less`; dumping megabytes into a terminal obscures the part you need.

### `tac`

`tac` prints lines in reverse order:

```shell
tac application.log | less
tac events.txt | grep -m 1 "deployment completed"
```

It is handy when the newest relevant line is near the end of a plain-text log and you want to search backward conceptually.

### `less`

`less` opens a file without loading the entire file into the terminal:

```shell
less /var/log/syslog
less +G application.log
command-producing-output | less
```

Navigation closely follows vim conventions: `j` and `k` move by line, `/` and `?` search forward and backward, `n` and `N` repeat a search, `g` and `G` jump to the beginning and end, and `q` quits. `Space` and `b` move by page. Unlike `more`, `less` makes backward movement natural.

### `head`

`head` reads the beginning of input:

```shell
head file.txt
head -n 20 file.txt
head -c 64 image.bin
```

It is useful for inspecting headers, samples, and the first records of generated data.

### `tail`

`tail` reads the end of input:

```shell
tail file.txt
tail -n 100 application.log
```

Logs are commonly chronological, so the last lines often contain the newest evidence.

### `tail -f`

`tail -f` continues watching a growing file:

```shell
tail -f /var/log/nginx/access.log
tail -F application.log
```

`-F` is more robust for logs that are rotated because it retries the filename if the underlying file is replaced. Stop following with `Ctrl-C`.

### `wc`

`wc` counts lines, words, and bytes:

```shell
wc file.txt
wc -l access.log
find . -type f -print0 | xargs -0 wc -l
```

Line counts are useful for quick validation, but remember that “line” means a newline-delimited record, not necessarily a semantic item.

### `file`

`file` inspects content signatures rather than trusting the filename:

```shell
file download
file --mime-type upload.bin
```

Use it when an extension is missing or misleading, or when determining whether a file is text, an executable, an archive, or another binary format.

### `stat`

`stat` reports detailed filesystem metadata:

```shell
stat config.yml
stat -c '%U %G %a %s %y %n' config.yml
```

It exposes ownership, permissions, size, inode, timestamps, and filesystem blocks. This is more precise than inferring metadata from an `ls -l` display.

## Searching Text and Files

### `grep`

`grep` searches lines for text or regular expressions:

```shell
grep "ERROR" application.log
grep -i "timeout" application.log
grep -RIn --exclude-dir=.git "deprecated_api" .
grep -E 'error|warning' application.log
```

`-i` ignores case, `-n` adds line numbers, `-R` searches recursively, and `-E` enables extended regular expressions. Quote patterns so the shell does not expand special characters before `grep` receives them.

### `find`

`find` walks directory trees and evaluates conditions:

```shell
find . -type f -name '*.log'
find /var/log -type f -size +100M
find . -type f -mtime -1
find . -type f -mmin -30
```

It can search by name, type, ownership, permissions, size, and modification time, then act on the result. It is one of the most important Linux tools because files remain the interface for configuration, logs, state, devices, and virtual kernel data.

Be explicit about precedence when expressions become complex. Test with `-print` before adding deletion or mutation:

```shell
find /tmp/example -type f -mtime +14 -print
find /tmp/example -type f -mtime +14 -delete
```

### `xargs`

`xargs` builds command invocations from standard input:

```shell
printf '%s\n' file1 file2 | xargs wc -l
find . -type f -name '*.tmp' -print0 | xargs -0 rm
```

Plain newline-separated input breaks on unusual filenames. Pair `find -print0` with `xargs -0` to use NUL delimiters safely. If the target command supports `find ... -exec ... +`, that is often even simpler:

```shell
find . -type f -name '*.tmp' -exec rm -- {} +
```

### `ripgrep` / `rg`

[ripgrep](https://github.com/BurntSushi/ripgrep) is a fast recursive text searcher:

```shell
rg 'TODO|FIXME'
rg -n --hidden -g '!.git' 'listen_port'
rg --files
```

It respects ignore files by default and skips hidden and binary files, making it particularly effective in source trees. Standard `grep` remains more universal; `rg` is the tool I reach for in projects.

## Editing Files

Every Linux user should be able to edit a file from a terminal. This matters when SSH is the only available interface, a graphical session is broken, or a minimal rescue system is all that boots.

### `nano`

`nano` is a straightforward terminal editor:

```shell
nano /etc/hosts
sudo nano /etc/systemd/system/example.service
```

Its important shortcuts are displayed at the bottom; `^` means `Ctrl`. It is a good choice when the task is simply to make a careful edit and leave.

### `vim`

`vim` is a modal editor installed on many systems:

```shell
vim config.yml
sudoedit /etc/ssh/sshd_config
```

In normal mode, press `i` to insert text, `Esc` to return to normal mode, `:w` to write, and `:q` to quit. For privileged configuration, prefer `sudoedit` where practical: it edits a temporary user-owned copy and installs it with elevated permission when saved.

### `nvim`

[Neovim](https://neovim.io/) is my preferred editor:

```shell
nvim .
nvim application.conf
```

It retains vim's editing model while providing a modern extension ecosystem and strong tooling integrations. My configuration is available in my [Neovim setup](https://github.com/dme86/neovim). Editor choice is personal; terminal competence is the operational requirement.

## User Identity, Groups, and Permissions

Traditional Unix permissions define access for the owning user, owning group, and everyone else. Each class can receive read (`r`), write (`w`), and execute (`x`) bits.

For directories, execute means traversal: without it, a process cannot access entries beneath the directory even if it knows their names. Read controls listing names, and write controls creating or removing entries. This distinction explains many apparently contradictory permission failures.

Permissions are among the first things to inspect when one user can perform an operation and another cannot, or when a service works interactively but fails under its service account.

### `whoami`

`whoami` prints the effective user name:

```shell
whoami
```

The effective identity determines most access checks. It may differ from the account that originally logged in after tools such as `sudo` or `su` are used.

### `id`

`id` reports numeric and named user and group identities:

```shell
id
id www-data
```

Numeric IDs are what the kernel and filesystems actually store. Names are resolved through local files or identity services.

### `groups`

`groups` gives a concise group-membership view:

```shell
groups
groups alice
```

New group membership usually requires a new login session before every process sees it.

### `sudo -l`

`sudo -l` lists the commands the current user may run through `sudo`:

```shell
sudo -l
sudo -l -U alice
```

This is safer than guessing and reveals command-specific restrictions. Being allowed one administrative command is not equivalent to unrestricted root access.

### `chmod`

`chmod` changes mode bits:

```shell
chmod u+x deploy.sh
chmod 640 secrets.conf
chmod -R u=rwX,g=rX,o= application/
```

Symbolic modes communicate intent; numeric modes are concise. Avoid casual `chmod -R 777`: it grants everyone write access and may make sensitive data executable. Capital `X` adds execute only to directories and files that already have an execute bit, which is safer for recursive changes.

The special setuid, setgid, and sticky bits alter normal behavior. Setuid and setgid can make an executable run with file-owner or group identity. Setgid on a directory makes new entries inherit its group. The sticky bit on a shared directory such as `/tmp` limits deletion to appropriate owners.

### `chown`

`chown` changes file ownership:

```shell
sudo chown alice report.txt
sudo chown -R app:app /srv/application
```

Recursive ownership changes can cross unexpected boundaries or damage application state. Verify the target and avoid following untrusted symlinks.

### `chgrp`

`chgrp` changes only the owning group:

```shell
sudo chgrp developers shared.conf
sudo chgrp -R developers shared/
```

It is useful for group-based collaboration without changing the owning user.

### `umask`

`umask` controls which permission bits are removed from newly created files and directories:

```shell
umask
umask 027
```

With a `027` umask, new files normally become `640` and directories `750`, assuming the application requests the conventional base modes. It affects creation defaults, not existing paths.

### `getfacl`

`getfacl` displays POSIX access control lists:

```shell
getfacl shared/
getfacl -p /srv/application/config
```

ACLs allow permissions for additional named users and groups beyond the three traditional classes. Check them when normal mode bits do not fully explain access.

### `setfacl`

`setfacl` changes POSIX ACLs:

```shell
setfacl -m u:alice:rw shared/report.csv
setfacl -m d:g:developers:rwx shared/
setfacl -x u:alice shared/report.csv
```

Default ACLs on a directory influence new children. ACLs are powerful but can make access harder to reason about, so use them deliberately and document shared-directory policies.

## Processes

A process is a running program instance with an address space, open resources, credentials, and a process ID (PID). Its parent process is identified by a PPID. Shells also manage foreground and background jobs: `command &` starts a background job, while `jobs`, `fg`, and `bg` control jobs belonging to that shell.

### `jobs`, `fg`, and `bg`

Shell job control manages commands started from the current interactive shell:

```shell
long-running-command &
jobs
fg %1
bg %1
```

`jobs` lists the shell's jobs, `fg` brings one to the foreground, and `bg` resumes a stopped job in the background. These job numbers are local to the shell and are not the same as system PIDs.

### `ps`

`ps` displays a snapshot of processes:

```shell
ps
ps -o pid,ppid,user,stat,etime,cmd -p 1234
```

Unlike `top`, it does not continuously refresh. Explicit output columns make incident notes and scripts easier to interpret.

### `ps aux`

The BSD-style `aux` form shows processes across users:

```shell
ps aux
ps aux --sort=-%mem | head
```

The exact columns vary, but `%CPU`, `%MEM`, `VSZ`, `RSS`, state, start time, and command are central. `RSS` approximates resident physical memory; `VSZ` is virtual address-space size and should not be read as actual RAM use.

### `ps -ef --forest`

The Unix-style form can show parent-child structure:

```shell
ps -ef --forest
```

The tree helps reveal supervisors, worker pools, shell wrappers, and orphaned descendants.

### `top`

`top` continuously displays process and system activity:

```shell
top
top -p 1234
```

Use it to establish whether CPU, memory, load, or a particular process is changing now. Treat it as an overview, then use more focused tools for evidence.

### `htop`

`htop` is a more approachable interactive process viewer:

```shell
htop
htop -p 1234,5678
```

It provides filtering, tree views, per-core meters, and interactive sorting. It may not be installed on minimal systems, so retain familiarity with `top` and `ps`.

### `pgrep`

`pgrep` finds process IDs by attributes:

```shell
pgrep nginx
pgrep -a -u app python
pgrep -P 1234
```

It is safer than parsing `ps | grep` because it understands process metadata directly. Use `-a` to confirm the full command line before acting.

### `pkill`

`pkill` sends a signal to processes selected by name or metadata:

```shell
pkill -TERM -u app worker
pkill -HUP nginx
```

Selection can be broader than intended. Preview the same criteria with `pgrep -a` first.

### `kill`

`kill` sends a signal to a PID:

```shell
kill 1234
kill -TERM 1234
kill -KILL 1234
kill -l
```

SIGTERM asks a process to shut down and gives it a chance to flush data and release resources. SIGKILL cannot be caught or handled; the kernel stops the process immediately. Use SIGKILL only after a graceful signal fails or the process is irrecoverably stuck. A killed process may be restarted by its service manager.

### `nice`

`nice` starts a process with an adjusted CPU scheduling priority:

```shell
nice -n 10 compression-job
```

A higher niceness value means lower CPU priority. It influences competition for CPU; it is not a hard resource limit.

### `renice`

`renice` changes the niceness of an existing process:

```shell
renice 10 -p 1234
sudo renice -5 -p 1234
```

Raising priority normally requires privilege. For service-level resource control, systemd and cgroups offer stronger, more explicit mechanisms.

## Open Files and Sockets

Linux exposes many resource types through file descriptors: regular files, sockets, pipes, terminals, and devices. `lsof` connects these resources back to processes, making it one of the most valuable general-purpose debugging tools.

### `lsof`

`lsof` lists open files:

```shell
sudo lsof /var/log/application.log
sudo lsof /mnt/data
sudo lsof -p 1234
```

Use it to identify which process holds a file, prevents a filesystem from being unmounted, or retains a device.

### `lsof -i`

The network selector displays internet sockets:

```shell
sudo lsof -i
sudo lsof -iTCP -sTCP:LISTEN -P -n
```

`-P` avoids service-name translation and `-n` avoids DNS lookups, producing faster and less ambiguous output.

### `lsof -i :PORT`

To debug “address already in use,” select the port:

```shell
sudo lsof -i :8080
sudo lsof -nP -iTCP:8080 -sTCP:LISTEN
```

The output identifies the process that owns the socket. Confirm whether it is an expected existing instance before stopping anything.

### `lsof +L1`

On Unix filesystems, deleting a pathname does not free its blocks while a process still has the file open:

```shell
sudo lsof +L1
```

This lists open files with a link count below one and explains a common `df` versus `du` discrepancy. Restart or reload the owning process gracefully so it closes the old file; do not truncate arbitrary file descriptors under `/proc` without understanding the application.

## Services and systemd

systemd is the init system and service manager used by most modern Linux distributions. As PID 1, it adopts orphaned processes, tracks system state, and starts or stops units. A unit is a resource systemd knows how to manage: services, sockets, mounts, devices, paths, timers, and others.

### `systemctl status`

Start service investigation here:

```shell
systemctl status sshd
systemctl status nginx.service
systemctl status --no-pager --full example.service
```

The status includes whether the unit loaded, whether it is active, its recent exit result, the main PID, and a small log excerpt. A green “active” state proves only that systemd considers the service running; it does not prove the application is healthy end to end.

### `systemctl start`

`start` activates a unit now:

```shell
sudo systemctl start nginx.service
```

It does not automatically configure the service to start after the next boot.

### `systemctl stop`

`stop` deactivates a unit:

```shell
sudo systemctl stop nginx.service
```

systemd follows the unit's configured stop behavior and timeouts. Dependencies or socket activation may start it again, so inspect the unit model if a service unexpectedly returns.

### `systemctl restart`

`restart` stops and starts a unit:

```shell
sudo systemctl restart nginx.service
```

This interrupts the service unless it has a special zero-downtime design. Validate configuration first when the application provides a check command.

### `systemctl reload`

`reload` asks a running service to reread configuration without a full restart:

```shell
sudo systemctl reload nginx.service
```

Reload support is application-specific. It usually preserves processes or connections, but a unit may not implement it. `systemctl reload-or-restart` is useful in automation that should reload when possible and restart otherwise.

### `systemctl enable`

`enable` configures a unit to participate in future boots or another unit's startup:

```shell
sudo systemctl enable nginx.service
sudo systemctl enable --now nginx.service
```

`--now` also starts it immediately. Without `--now`, enablement and current runtime state are separate.

### `systemctl disable`

`disable` removes enablement links:

```shell
sudo systemctl disable nginx.service
sudo systemctl disable --now nginx.service
```

It does not prevent every form of activation. Another unit, socket, timer, or manual command may still start the service. `mask` is stronger, but should be used only when intentionally making activation impossible.

### `systemctl cat`

`cat` shows the unit definition and drop-in overrides:

```shell
systemctl cat nginx.service
systemctl cat example.timer
```

This is better than guessing which file under `/usr/lib`, `/lib`, or `/etc` is effective. Use `systemctl edit` to create an override instead of modifying a package-owned unit file.

### `systemctl show`

`show` exposes machine-readable unit properties:

```shell
systemctl show nginx.service
systemctl show -p MainPID -p ExecMainStatus -p FragmentPath nginx.service
```

It is useful in scripts and when `status` omits a detail such as restart count, resource accounting, or dependency state.

### `systemctl --failed`

List failed units across the system:

```shell
systemctl --failed
```

Investigate each with `systemctl status` and `journalctl -u`. After resolving the cause, `systemctl reset-failed` clears the recorded failed state; it does not fix the failure itself.

### `systemctl list-timers`

systemd timers schedule work:

```shell
systemctl list-timers
systemctl list-timers --all
```

The output shows the previous and next activation and the service each timer triggers. Use `--all` to include inactive timers.

## Logs

Logs are usually the first debugging layer because they record what the system or application believed was happening. Read them with timestamps and context, and corroborate them with current state. An error message is evidence, not always the root cause.

Modern systemd systems collect service and kernel messages in the journal. Traditional text logs still live under `/var/log` on many distributions, including authentication, package-manager, web-server, and application-specific logs.

### `journalctl`

`journalctl` queries the systemd journal:

```shell
journalctl
journalctl -b
journalctl -b -1
journalctl -p warning
```

`-b` limits output to the current boot; `-b -1` selects the previous boot. This distinction is critical when the machine rebooted after a failure.

### `journalctl -u`

Filter by systemd unit:

```shell
journalctl -u nginx.service
journalctl -u nginx.service -b --no-pager
journalctl -u example.service -n 100
```

This removes unrelated system noise and gives service lifecycle messages alongside its standard output and error.

### `journalctl -f`

Follow new journal entries:

```shell
journalctl -f
journalctl -fu nginx.service
```

Run this in one terminal while reproducing a failure in another. Stop with `Ctrl-C`.

### `journalctl -xe`

Show recent messages with explanations where the journal has catalog metadata:

```shell
journalctl -xe
journalctl -xeu nginx.service
```

It is a useful broad view immediately after a failed administrative action. The `-x` explanations can help, but they are generic guidance rather than diagnosis.

### `journalctl -k`

Show kernel messages stored in the journal:

```shell
journalctl -k
journalctl -k -b -1
```

This is often preferable to `dmesg` when investigating an earlier boot because persistent journals can retain historical kernel messages.

### `journalctl --since`

Restrict logs to a relevant time window:

```shell
journalctl --since "30 minutes ago"
journalctl -u nginx.service --since "2026-06-29 09:00" --until "2026-06-29 09:30"
```

Time scoping reduces noise and lets you correlate logs with a deployment, scheduled job, or alert.

### `dmesg`

`dmesg` reads the kernel ring buffer:

```shell
sudo dmesg
sudo dmesg -T | less
```

The ring buffer is a bounded, in-memory stream of kernel messages. It is useful for hardware detection, driver failures, filesystem errors, device resets, out-of-memory kills, and boot problems. Because it is bounded, old messages can be overwritten; journal persistence is more suitable for history. Human-readable `-T` timestamps are convenient but can be inaccurate if the wall clock changed.

### `dmesg -w`

Follow new kernel messages:

```shell
sudo dmesg -w
```

This is useful while attaching a device, reproducing a storage error, or loading a driver.

### `dmesg --level=err,warn`

Filter by severity:

```shell
sudo dmesg --level=err,warn
```

This quickly surfaces serious messages, but filtering can hide the informational context immediately before the failure. Return to the unfiltered stream when the cause remains unclear.

## Storage, Filesystems, and Mounts

A filesystem organizes data on a storage device or logical volume. Linux attaches each filesystem to one directory in a single directory tree; that directory is its mount point.

Disk blocks and inodes are separate resources. Blocks hold file content and metadata. Inodes represent filesystem objects. A filesystem with free bytes can still fail to create files if it has exhausted inodes.

### `df -h`

`df` reports usage from the mounted filesystem's perspective:

```shell
df -h
df -h /var
```

Use it to answer “which filesystem is full?” rather than “which directory is large?” Reserved blocks, snapshots, deleted-open files, and filesystem metadata can affect what it reports.

### `df -i`

Inspect inode consumption:

```shell
df -i
df -i /var
```

Millions of tiny cache, queue, session, or mail files can exhaust inodes before consuming all bytes.

### `du -sh`

`du` totals blocks reachable through directory entries:

```shell
du -sh /var/log
du -sh ./* 2>/dev/null
```

This answers “which visible directory consumes space?” It may require root permission for a complete result.

### `du -xhd1`

Summarize one directory level without crossing filesystem boundaries:

```shell
sudo du -xhd1 /
sudo du -xhd1 /var | sort -h
```

`-x` stays on one filesystem, `-h` formats sizes, and `-d1` limits depth. This is a practical first pass during a disk-full incident.

`df` and `du` can disagree because they measure different views. Common causes include deleted-but-open files, mounted filesystems hiding underlying data, snapshots, sparse files, reserved blocks, and filesystem metadata.

### `lsblk`

`lsblk` displays block devices and their relationships:

```shell
lsblk
lsblk -f
lsblk -o NAME,SIZE,TYPE,FSTYPE,FSVER,LABEL,UUID,MOUNTPOINTS
```

It reveals disks, partitions, device-mapper layers, LVM volumes, filesystems, and mount points. Check this before assuming that `/dev/sdb` is the device you expect.

### `blkid`

`blkid` probes filesystem identifiers:

```shell
sudo blkid
sudo blkid /dev/nvme0n1p2
```

Persistent configurations normally refer to UUIDs or labels because kernel device names can change across boots or hardware changes.

### `findmnt`

`findmnt` presents the current mount tree:

```shell
findmnt
findmnt /
findmnt -T /var/lib/application/data.db
```

`-T` resolves which mounted filesystem contains a path. This avoids mistakes on systems with bind mounts, containers, or nested filesystems.

### `mount`

Without arguments, `mount` lists current mounts; with arguments, it attaches a filesystem:

```shell
mount
sudo mount /dev/sdb1 /mnt/data
sudo mount -o ro /dev/sdb1 /mnt/recovery
```

Mounting read-only is a sensible first choice during recovery. Filesystem type, options, permissions, and application consistency all matter.

### `umount`

`umount` detaches a filesystem:

```shell
sudo umount /mnt/data
sudo umount /dev/sdb1
```

If the target is busy, use `lsof` or `fuser` to find processes whose working directories or open files keep it active. Lazy or forced unmounts can hide a problem and should not be the first response.

### `cat /etc/fstab`

`/etc/fstab` describes filesystems that should be mounted declaratively:

```shell
cat /etc/fstab
findmnt --verify
sudo mount -a
```

An invalid entry can delay or break boot. Prefer UUIDs, understand options such as `nofail` and automount behavior, and run `findmnt --verify` before testing with `mount -a`. Keep a recovery path when changing the root or boot mounts.

Filesystem-specific maintenance differs. Btrfs, for example, adds subvolumes, snapshots, compression, and its own space-accounting considerations. See [BTRFS, Subvolumes, Snapshots, and Snapper]({% post_url 2026-06-12-BTRFS-Subvolumes-Snapshots-and-Snapper %}) for that deeper layer.

## Memory and OOM

Linux uses otherwise idle memory for page cache because cached files are faster than storage. Therefore, a small `free` value does not by itself mean the host lacks memory. The `available` estimate is generally more useful.

Swap is backing storage for memory pages. Moderate swap use is not automatically a failure; sustained swap-in and swap-out under pressure often is. When allocation cannot be satisfied, the kernel or a cgroup may invoke an out-of-memory killer and terminate a process.

### `free -h`

Get a compact memory overview:

```shell
free -h
```

Read `available` as the estimate of memory that can be allocated without heavy swapping. `buff/cache` is largely reclaimable kernel and filesystem cache, not simply wasted or permanently occupied RAM.

### `cat /proc/meminfo`

Inspect detailed kernel memory counters:

```shell
cat /proc/meminfo
```

Fields such as `MemAvailable`, `Cached`, `SwapTotal`, `SwapFree`, `Slab`, `Dirty`, and `Writeback` help distinguish application memory, cache, kernel objects, and pending storage writes.

### `vmstat 1`

Sample system activity once per second:

```shell
vmstat 1
```

After the first cumulative line, watch `si` and `so` for swap I/O, `r` for runnable tasks, `b` for blocked tasks, `wa` for I/O wait, and `us`/`sy`/`id` for CPU state. Trends matter more than one sample.

### `ps aux --sort=-%mem`

Sort processes by their reported share of RAM:

```shell
ps aux --sort=-%mem | head -n 20
```

This is a quick lead, not perfect accounting. Shared pages, child processes, caches, and cgroups complicate attribution.

### `cat /proc/<PID>/status`

Read a process's summarized kernel state:

```shell
cat /proc/1234/status
grep -E '^(Name|State|VmRSS|VmSize|Threads):' /proc/1234/status
```

`VmRSS` is resident memory and `VmSize` is virtual address space. A large virtual size may represent mappings that consume little physical memory.

### `cat /proc/<PID>/smaps_rollup`

Get aggregated memory-map accounting:

```shell
cat /proc/1234/smaps_rollup
```

Proportional set size (`Pss`) divides shared pages among processes and often gives a better attribution estimate than RSS. Access to another user's process may be restricted.

### `journalctl -k | grep -i oom`

Search journaled kernel messages for OOM evidence:

```shell
journalctl -k | grep -iE 'oom|out of memory|killed process'
```

Look for the selected victim, memory context, and whether the event came from the global host or a constrained cgroup.

### `dmesg | grep -i oom`

Search the current kernel ring buffer:

```shell
sudo dmesg | grep -iE 'oom|out of memory|killed process'
```

This is fast but may miss older events that have rotated out. A container can be OOM-killed because its cgroup limit was reached even while the host still has available memory; always inspect container or service limits as well as host totals.

## CPU and Load

Load average counts runnable tasks plus tasks in uninterruptible sleep, usually waiting for I/O. It is not CPU percentage. A load of 8 may saturate a four-CPU host, fit comfortably on a 32-CPU host, or reflect storage waits rather than computation.

### `uptime`

`uptime` shows boot duration, logged-in users, and load averages:

```shell
uptime
```

The three load values cover approximately 1, 5, and 15 minutes. Compare them with available logical CPUs and with per-state metrics before drawing conclusions.

### `top` for CPU

Use `top` to correlate load with CPU states and processes:

```shell
top
```

High user (`us`) time suggests application computation, high system (`sy`) time suggests kernel work, and high I/O wait (`wa`) suggests CPUs are idle while tasks wait for storage. Per-core views can reveal one saturated thread on an otherwise idle machine.

### `htop` for CPU

`htop` makes per-core use and process sorting easy:

```shell
htop
```

Sort by CPU and enable threads when diagnosing a multi-threaded application. Color schemes differ, so read the local meter legend rather than assuming.

### `mpstat`

`mpstat` from the `sysstat` package reports per-CPU utilization:

```shell
mpstat 1
mpstat -P ALL 1
```

It helps distinguish whole-host saturation from a workload pinned to one CPU and exposes steal time in virtualized environments.

### `pidstat`

`pidstat` samples process and thread activity:

```shell
pidstat 1
pidstat -t -p 1234 1
```

Unlike a sorted snapshot, it shows how use changes over time. This is useful for intermittent spikes and worker-thread imbalance.

### `vmstat 1` for CPU

The same `vmstat` stream ties scheduler pressure to CPU and I/O:

```shell
vmstat 1
```

If the run queue (`r`) remains far above CPU count while idle time is near zero, CPU saturation is plausible. If blocked tasks (`b`) and I/O wait are high, investigate storage instead.

### `ps aux --sort=-%cpu`

Get a quick process ranking:

```shell
ps aux --sort=-%cpu | head -n 20
```

`ps` CPU percentages may be averaged over process lifetime rather than the exact current second, depending on implementation. Use it to identify candidates, then sample them with `top`, `pidstat`, or profiling tools.

## Disk I/O and Performance

Slow storage can make an application time out while CPU and memory look healthy. Queueing occurs below the application, so inspect device and process I/O directly.

### `iostat -xz 1`

Extended device statistics come from the `sysstat` package:

```shell
iostat -xz 1
```

Important fields vary by version, but include operations per second, throughput, average request latency, queue depth, and utilization. High utilization is meaningful only in context: modern parallel devices can serve many requests concurrently, while one slow disk can be saturated by a small workload.

### `iotop`

`iotop` attributes current I/O to tasks:

```shell
sudo iotop
sudo iotop -oPa
```

`-o` shows active tasks, `-P` groups by process, and `-a` accumulates totals. Kernel configuration and permissions can affect availability and accuracy.

### `pidstat -d 1`

Sample per-process disk activity:

```shell
pidstat -d 1
pidstat -d -p 1234 1
```

This provides read/write rates and I/O delay without an interactive interface, which is convenient for recording evidence.

## Networking

Network debugging is easiest when treated as layers: interface state, address, route, local listener, DNS, TCP reachability, application protocol, and finally packets.

### `ip addr`

Show addresses assigned to interfaces:

```shell
ip addr
ip -br addr
```

Check that the expected interface is up and has the expected IPv4 or IPv6 address and prefix.

### `ip link`

Inspect link-layer state:

```shell
ip link
ip -s link show dev eth0
```

Counters and flags reveal whether the link is up and whether errors or drops are increasing. An administratively up interface can still lack physical carrier.

### `ip route`

Inspect the routing decision:

```shell
ip route
ip route get 1.1.1.1
```

`ip route get` asks the kernel which source address, interface, gateway, and route it would use for one destination. It is more precise than visually guessing from the route table.

### `ss -tulpn`

Show listening TCP and UDP sockets:

```shell
sudo ss -tulpn
```

This is the modern replacement for the common `netstat -tulpn` workflow. Check whether the service listens, on which port, and on which address. Listening on `127.0.0.1` is different from listening on every interface.

### `ss -tanp`

Show TCP sockets, including established and transitional connections:

```shell
sudo ss -tanp
ss -tan state time-wait
```

Socket states can reveal connection floods, backlog trouble, failed teardown, or a missing client connection.

### `ping`

`ping` sends ICMP echo requests:

```shell
ping -c 4 192.0.2.10
ping -c 4 example.com
```

It tests name resolution when given a hostname and IP reachability when given an address. Failure does not prove the host is down because ICMP may be filtered; success does not prove the application port works.

### `traceroute`

`traceroute` probes the path toward a destination:

```shell
traceroute example.com
traceroute -T -p 443 example.com
```

Intermediate routers may suppress or rate-limit responses, so missing hops are not necessarily packet loss. TCP mode can be more representative when debugging an allowed application port.

### `tracepath`

`tracepath` is a commonly unprivileged alternative:

```shell
tracepath example.com
```

It also helps discover path MTU. Availability differs by distribution.

### `dig`

`dig` performs explicit DNS queries:

```shell
dig example.com
dig +short example.com
dig @1.1.1.1 example.com A
dig example.com AAAA
```

Inspect the response code, answer, selected server, and record lifetime. Querying a specific server helps distinguish authoritative data from a local resolver problem, but do not bypass internal DNS when investigating internal names.

### `resolvectl status`

On systems using systemd-resolved, inspect resolver configuration:

```shell
resolvectl status
resolvectl query example.com
```

The output connects DNS servers and search domains to interfaces, which matters with VPNs and split DNS.

### `curl -v`

Verbose `curl` exposes the HTTP connection sequence:

```shell
curl -v https://example.com/health
curl -vk https://example.com/health
```

It shows DNS targets, connection attempts, TLS negotiation, request headers, and response headers. `-k` disables certificate verification and is appropriate only as a diagnostic comparison, never as the permanent fix.

### `curl -I`

Request response headers only:

```shell
curl -I https://example.com/
curl -IL https://example.com/
```

`-L` follows redirects. Some servers implement `HEAD` differently from `GET`, so confirm with a normal request when behavior is surprising.

### `nc -vz`

Netcat can test whether a TCP connection opens:

```shell
nc -vz db.example.net 5432
nc -vz -w 3 192.0.2.10 443
```

This isolates DNS and transport connectivity from the higher-level protocol. A successful connection proves that something accepted TCP, not that it is the right service or healthy.

### `tcpdump`

`tcpdump` captures packets:

```shell
sudo tcpdump -ni any port 443
sudo tcpdump -ni eth0 host 192.0.2.10
sudo tcpdump -ni any -w incident.pcap 'host 192.0.2.10 and tcp port 443'
```

Use narrow capture filters to control noise and data exposure. Packet captures may contain credentials, personal data, or application payloads; handle them as sensitive evidence. `tcpdump` answers whether packets arrived, left, were retransmitted, or received resets when higher-level tools cannot explain the path.

## Packages and Updates

Security fixes, correctness fixes, and supported dependency versions make updates part of maintenance. Production updates still require discipline: know what will change, use staged rollout where possible, preserve rollback options, and validate the service afterward.

### `apt update`

On Debian and Ubuntu, refresh repository metadata:

```shell
sudo apt update
```

This does not install upgrades. It updates the local view of available package versions and should precede upgrade planning.

### `apt list --upgradable`

Preview packages with newer candidates:

```shell
apt list --upgradable
```

Review critical libraries, daemons, and kernels rather than treating the count alone as risk.

### `apt upgrade`

Install available upgrades without removing installed packages:

```shell
sudo apt upgrade
```

Read the proposed transaction before confirming. `apt full-upgrade` may remove packages to resolve dependency changes and therefore deserves additional scrutiny.

### `apt-cache policy`

Inspect installed and candidate versions and their repository priorities:

```shell
apt-cache policy openssl
apt-cache policy nginx
```

This is useful when a package is held back, pinned, or unexpectedly sourced from a third-party repository.

### `dpkg -l`

List package database state:

```shell
dpkg -l
dpkg -l 'linux-image*'
```

The first two status letters matter; `ii` means the package is desired and installed. This command reports local package state, not available updates.

### `needrestart`

On Debian and Ubuntu, `needrestart` detects processes still using replaced libraries and whether a reboot is recommended:

```shell
sudo needrestart
```

Package hooks may run it automatically. A kernel package can be installed while the machine continues running the old kernel until reboot.

### `dnf check-update`

On Fedora, RHEL, and related systems, check for updates:

```shell
sudo dnf check-update
```

An exit status of `100` conventionally means updates are available, not that the command failed. Automation must account for that.

### `dnf upgrade`

Install package upgrades:

```shell
sudo dnf upgrade
```

Review the transaction, repositories, and removals before approval, especially on hosts with third-party repositories or module streams.

### `dnf info`

Inspect a package:

```shell
dnf info openssl
dnf info --installed nginx
```

This shows version, repository, architecture, and description, helping verify package origin.

### `rpm -qa`

Query installed RPM packages:

```shell
rpm -qa
rpm -qa | sort
rpm -qf /usr/bin/ss
```

`rpm -qf` maps a file to its owning package, a useful clue when documentation or an executable is unexpected.

## Scheduled Jobs

Scheduled jobs perform backups, cleanup, certificate renewal, synchronization, monitoring, and log rotation. They also create failures that seem spontaneous because no human was logged in when the change occurred.

### `crontab -l`

List the current user's cron table:

```shell
crontab -l
sudo crontab -l
sudo crontab -u app -l
```

Each user can have a different crontab, including root. Cron runs with a limited environment, so use absolute paths and explicitly set required variables.

### `/etc/crontab`

The system crontab includes an explicit user field:

```shell
cat /etc/crontab
```

Do not copy a user-crontab line here without adding the user column. Distribution conventions differ, so read the comments and `man 5 crontab`.

### `/etc/cron.*`

Distributions commonly provide periodic directories:

```shell
ls -la /etc/cron.d/
ls -la /etc/cron.hourly/
ls -la /etc/cron.daily/
ls -la /etc/cron.weekly/
```

Check all of them when searching for hidden maintenance activity. Package installation often adds jobs under `/etc/cron.d`.

### `systemctl list-timers` for Scheduled Jobs

Timers are now preferred for many packaged tasks:

```shell
systemctl list-timers --all
systemctl status example.timer
systemctl cat example.timer
```

systemd timers provide explicit dependency handling, journal integration, missed-run behavior, and randomized delays. Cron remains simple and portable; neither mechanism is universally superior.

## Log Rotation

Logs that grow forever eventually fill a filesystem. Rotation renames or archives old logs, optionally compresses them, retains a bounded history, and signals applications to reopen their files.

### `logrotate -d`

Debug configuration without rotating files:

```shell
sudo logrotate -d /etc/logrotate.conf
```

Debug mode explains which rules match and what logrotate would do. It is the safest first step. `-f` forces rotation and changes state, so use it only when deliberately testing the full workflow.

### `/etc/logrotate.conf`

The main configuration defines defaults and includes:

```shell
less /etc/logrotate.conf
```

Check retention count, frequency, compression, ownership, and included directories. Rotation frequency also depends on how often the scheduler invokes logrotate.

### `/etc/logrotate.d/`

Packages and applications usually install specific rules here:

```shell
ls -la /etc/logrotate.d/
less /etc/logrotate.d/nginx
```

When a deleted log remains open, verify that the rule tells the application to reopen it. `copytruncate` can avoid signaling but has race and data-loss tradeoffs; a native reopen signal is generally cleaner.

## Kernel Interfaces: `/proc`, `/sys`, and `sysctl`

`/proc` and `/sys` are virtual filesystems. Much of their content is generated dynamically by the kernel rather than stored on disk. `/proc` exposes process and general kernel state; `/sys` presents devices, drivers, buses, classes, and tunable attributes in a more structured model.

### `uname -a`

Show kernel and machine information:

```shell
uname -a
uname -r
```

The running kernel version may differ from the newest installed kernel after an update.

### `cat /proc/cmdline`

Inspect parameters supplied to the running kernel:

```shell
cat /proc/cmdline
```

This confirms the root device, console settings, security modes, cgroup options, and other boot-time choices actually used.

### `cat /proc/cpuinfo`

Read the kernel's per-logical-CPU information:

```shell
cat /proc/cpuinfo
lscpu
```

`lscpu` is usually easier for a summary, while `/proc/cpuinfo` exposes raw per-CPU fields and flags.

### `cat /proc/meminfo` for Kernel Memory

Inspect detailed memory counters:

```shell
cat /proc/meminfo
```

The file is also a direct source for many values summarized by `free`.

### `ls /sys`

Explore the kernel's device model cautiously:

```shell
ls /sys
ls /sys/class/net
ls /sys/block
```

Reading is generally safe. Writing to sysfs attributes can immediately change device or driver behavior, so consult kernel or distribution documentation first.

### `sysctl -a`

List available runtime kernel parameters:

```shell
sysctl -a
```

The output is large and some entries may produce permission warnings. Filter it rather than treating it as a routine checklist:

```shell
sysctl -a 2>/dev/null | grep '^net.ipv4'
```

### `sysctl net.ipv4.ip_forward`

Read or change IPv4 forwarding:

```shell
sysctl net.ipv4.ip_forward
sudo sysctl -w net.ipv4.ip_forward=1
```

`-w` changes the live kernel value. Enabling forwarding has architectural and security consequences; firewall policy must match the intended routing role.

### `sysctl vm.swappiness`

Inspect or tune the kernel's relative preference for swapping:

```shell
sysctl vm.swappiness
sudo sysctl -w vm.swappiness=20
```

Swappiness is not a percentage threshold and lowering it is not a universal performance fix. Tune only from workload evidence.

Persistent sysctl settings normally live in `/etc/sysctl.conf` or files under `/etc/sysctl.d/`:

```shell
sudo sysctl --system
```

Use a documented drop-in, apply it, and verify the effective value. Runtime changes disappear after reboot unless persisted.

## Debugging with Tracing

When logs describe only the symptom, system-call tracing shows how a program interacts with the kernel. It can expose missing files, permission failures, DNS and socket activity, subprocesses, and blocking operations.

### `strace`

Trace a new process:

```shell
strace ls /path/that/does/not/exist
strace -o trace.log application --config config.yml
```

Read from the end first, then search for errors such as `ENOENT`, `EACCES`, `ECONNREFUSED`, or `ETIMEDOUT`. Not every failed syscall is a bug; programs routinely probe multiple paths.

### `strace -f`

Follow child processes and threads:

```shell
strace -f -o trace.log build-command
```

Without `-f`, the relevant failure may occur in a subprocess that is invisible to the trace.

### `strace -p <PID>`

Attach to a running process:

```shell
sudo strace -p 1234
sudo strace -tt -p 1234
```

This can answer what a hung process is waiting on. Attaching pauses it briefly and tracing can add overhead, so use care on latency-sensitive production processes.

### `strace -e openat`

Trace file-open attempts:

```shell
strace -e trace=openat application
strace -f -e trace=openat -o files.trace application
```

This is excellent when a program cannot find configuration, libraries, certificates, or data. The returned path and error code provide concrete evidence.

### `strace -e connect`

Trace connection attempts:

```shell
strace -f -e trace=connect application
```

It reveals socket families, destination addresses, and immediate kernel errors. Combine it with DNS inspection and packet capture when connection attempts never complete.

### `perf`

Linux `perf` samples kernel and application performance:

```shell
sudo perf top
sudo perf record -g -p 1234 -- sleep 30
sudo perf report
```

Use it when the question is where CPU time goes, not merely which process uses CPU. Symbols, kernel permissions, and compiler settings affect the quality of results.

## Containers and Linux Primitives

Containers are processes isolated and controlled with Linux primitives, not miniature virtual machines. Namespaces give processes different views of resources such as PIDs, mounts, networks, users, and hostnames. Cgroups account for and limit CPU, memory, I/O, and process counts. Docker, containerd, and Kubernetes compose these mechanisms with images, networking, and orchestration.

### `cat /proc/self/cgroup`

Inspect the current process's cgroup membership:

```shell
cat /proc/self/cgroup
```

On cgroup v2, a `0::/path` entry identifies the unified hierarchy path. This can help confirm whether a shell is inside a container or service scope.

### `readlink /proc/self/ns/*`

List namespace identities for the current process:

```shell
readlink /proc/self/ns/*
readlink /proc/1/ns/*
```

Matching namespace type and inode values mean two processes share that namespace. Permission restrictions may hide some targets.

### `lsns`

`lsns` summarizes namespaces:

```shell
lsns
lsns -p 1234
lsns -t net
```

It maps namespace IDs to types, processes, users, and commands, making container boundaries visible from the host.

### `nsenter`

Enter one or more namespaces of another process:

```shell
sudo nsenter -t 1234 -m -u -i -n -p
sudo nsenter -t 1234 -n ss -tulpn
```

This is valuable when a minimal container has no debugging tools: use host tools inside its network or mount view. It is also privileged and bypasses normal container tooling, so record what you do and avoid modifying state casually.

### `cat /sys/fs/cgroup/cgroup.controllers`

On cgroup v2, list resource controllers available to the current cgroup:

```shell
cat /sys/fs/cgroup/cgroup.controllers
```

Common controllers include `cpu`, `memory`, `io`, and `pids`. Availability and delegation depend on the parent hierarchy.

### `cat /sys/fs/cgroup/memory.current`

Read current memory charged to a cgroup:

```shell
cat /sys/fs/cgroup/memory.current
cat /sys/fs/cgroup/memory.max
cat /sys/fs/cgroup/memory.events
```

Paths differ by service and container. `memory.events` is particularly useful for distinguishing pressure, limit hits, and cgroup OOM kills.

### `cat /sys/fs/cgroup/cpu.stat`

Read cgroup CPU accounting:

```shell
cat /sys/fs/cgroup/cpu.stat
cat /sys/fs/cgroup/cpu.max
```

Throttling counters can explain poor application latency even when host CPU is not saturated. A container's quota is its effective world.

## Practical Debugging Checklist

When a Linux system or service is broken, work through evidence in roughly this order:

- Is the machine reachable?
- Can I log in?
- Is the service running?
- What does `systemctl status` report?
- What do the service and kernel logs say?
- Is the relevant filesystem full?
- Are its inodes full?
- Is memory exhausted or swapping heavily?
- Was the host or cgroup OOM killer involved?
- Is CPU saturated, throttled, or merely showing high load?
- Is disk I/O the bottleneck?
- Is the expected port listening on the expected address?
- Does DNS return the intended address?
- Does TCP connectivity work from the affected client?
- Are file, directory, socket, or ACL permissions wrong?
- Did a cron job or systemd timer run?
- Did an update, deployment, reboot, or configuration change happen recently?
- Can `man`, `--help`, `systemctl status`, or `journalctl` explain the next clue?

Keep a timeline while investigating. Record commands, timestamps, affected versions, and observed changes. Change one variable at a time where possible. A restart may restore service, but capture logs and state first if the evidence will disappear.

## Conclusion

Linux maintenance is less about memorizing every command than understanding the system's layers and knowing where each layer exposes evidence. A competent operator moves deliberately through processes, logs, filesystems, memory, CPU, I/O, networking, permissions, and kernel signals until the observations support a cause.

Documentation is part of the operating system's interface. `man`, `--help`, unit definitions, service logs, and kernel messages are not side quests; they are how the system explains itself. Learn to ask precise questions of those interfaces, and Linux becomes far less mysterious.
