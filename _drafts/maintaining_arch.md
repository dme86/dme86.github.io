# Arch Maintenance
This article describes how I maintain my Arch systems, providing an exclusive insight into the simplicity of keeping a system clean and minimal.

## Disk Usage

### Automated

To keep disk usage low on my machines, I employ automation that regularly deletes unnecessary resources.
It is crucial for automated jobs to only clean up files and caches that are genuinely no longer needed for daily use.
I use the [paccache](https://man.archlinux.org/man/paccache.8) script, available via [pacman-contrib](https://archlinux.org/packages/?name=pacman-contrib), to weekly delete unneeded cache files from pacman.

Enabling and starting the `paccache.timer` is done with the following systemd command:

```bash
systemctl enable --now paccache.timer
```

Additionally, I've installed [paccache-hook](https://aur.archlinux.org/packages/paccache-hook) from the [AUR](https://wiki.archlinux.org/title/Arch_User_Repository) to automatically trigger `paccache` after every pacman transaction. I also check pacman for orphaned packages using a specific hook:

    # enter hook here

Since I use containers, I regularly delete old container resources:

    # enter stuff here

### Manual

Periodically, I use the command-line tool [ncdu](https://dev.yorhel.nl/ncdu), providing an excellent overview of folders and file sizes. This tool helps me quickly identify larger directories, allowing me to ensure that the bytes are well-spent or if they are unnecessary.

## Mirrors

For optimizing mirror selection, I recommend using [reflector](https://wiki.archlinux.org/title/reflector). It helps in automatically generating a mirrorlist based on the most up-to-date and fastest mirrors.

## Backups

[Include content about your backup strategy here.]

## Tips
