---
title: Running a Tor Exit Node on CentOS Stream 9 with Ansible
description: "How to bootstrap and harden a Tor exit relay on CentOS Stream 9 with Ansible."
layout: post
date: 2026-06-09 13:00:00 +0200
tags: [Ansible, CentOS]
---

If you want to operate a Tor exit node properly, you should avoid doing it by hand.

You need a repeatable bootstrap, a hardened SSH configuration, a firewall that only exposes what you actually need, a local resolver, and a maintenance path that does not turn into improvisation after the first update cycle.

I still like CentOS Stream 9 for this kind of infrastructure work. I explained why in an earlier article here: [Why I Continue To Advocate For CentOS Stream In Production Environments](https://dme86.github.io/2024/03/05/Why-I-Continue-to-Advocate-for-CentOS-Stream-in-Production-Environments/).

In this article, I will show a small Ansible setup that bootstraps a CentOS Stream 9 host, configures it as a Tor exit relay, adds a local Unbound resolver, hardens SSH, enables fail2ban, and gives you a minimal maintenance workflow.

All hostnames, IP addresses, nicknames, usernames and contact details below are sanitized examples, but the structure mirrors a real setup.

<!-- more -->

## Generate an SSH Key First

Before you touch Ansible, create a dedicated SSH keypair for the host:

```shell
ssh-keygen -t ed25519 -f ~/.ssh/tor_exit_ed25519 -C "tor-exit"
```

This gives you:

- `~/.ssh/tor_exit_ed25519`
- `~/.ssh/tor_exit_ed25519.pub`

You can then use the private key to connect to the VPS and the public key as the administrative key installed by Ansible.

If the machine is fresh and still allows password login for the provider user, a simple first connection might look like this:

```shell
ssh -i ~/.ssh/tor_exit_ed25519 bootstrap@203.0.113.10
```

## Repository Layout

A small structure like this is enough:

```text
.
├── group_vars/
│   └── tor_exit.yml
├── inventory.yml
├── playbooks/
│   ├── check.yml
│   ├── fail2ban.yml
│   ├── hardening-services.yml
│   ├── init.yml
│   ├── maintenance.yml
│   ├── site.yml
│   ├── ssh-hardening.yml
│   └── unbound.yml
├── requirements.yml
└── templates/
    ├── torrc.j2
    └── unbound.conf.j2
```

Install the required Ansible collection:

```shell
ansible-galaxy collection install -r requirements.yml
```

## Inventory and Variables

This inventory keeps the target definition very small:

{% raw %}
```yaml
# inventory.yml
all:
  children:
    tor_exit:
      hosts:
        tor-exit-01:
          ansible_host: 203.0.113.10
          ansible_user: bootstrap
          ansible_ssh_private_key_file: ~/.ssh/tor_exit_ed25519
```
{% endraw %}

And the group variables define the relay itself:

{% raw %}
```yaml
# group_vars/tor_exit.yml
tor_nickname: "ExampleExit01"
tor_contact_info: "abuse: tor-admin@example.org"
tor_exit_policy_mode: "web_only"
tor_exit_policy_custom:
  - "accept *:80"
  - "accept *:443"
  - "reject *:*"

tor_or_port: 9001

tor_relay_bandwidth_rate: "5 MB"
tor_relay_bandwidth_burst: "10 MB"

admin_user: "admin"
admin_ssh_public_key: "{{ lookup('file', '~/.ssh/tor_exit_ed25519.pub') }}"
```
{% endraw %}

The collection dependency is minimal:

```yaml
# requirements.yml
collections:
  - name: ansible.posix
```

## Bootstrap the Host

The first playbook prepares a CentOS Stream 9 system for normal Ansible use. It creates swap, installs Python, enables CRB and EPEL, brings up `firewalld`, and installs your administrative SSH key.

{% raw %}
```yaml
# playbooks/init.yml
---
- name: Initial bootstrap for CentOS Stream 9
  hosts: tor_exit
  become: true
  gather_facts: false

  tasks:

    - name: Check if swapfile exists
      ansible.builtin.stat:
        path: /swapfile
      register: swapfile_stat

    - name: Create swapfile
      ansible.builtin.command:
        cmd: fallocate -l 1G /swapfile
      when: not swapfile_stat.stat.exists

    - name: Set swapfile permissions
      ansible.builtin.file:
        path: /swapfile
        owner: root
        group: root
        mode: "0600"

    - name: Format swapfile
      ansible.builtin.command:
        cmd: mkswap /swapfile
      when: not swapfile_stat.stat.exists

    - name: Enable swapfile
      ansible.builtin.command:
        cmd: swapon /swapfile
      when: not swapfile_stat.stat.exists

    - name: Persist swapfile in fstab
      ansible.builtin.lineinfile:
        path: /etc/fstab
        line: "/swapfile none swap sw 0 0"
        state: present

    - name: Install Python and DNF helpers
      ansible.builtin.raw: |
        dnf -y install python3 python3-dnf dnf-plugins-core sudo
      changed_when: false

    - name: Gather facts after Python bootstrap
      ansible.builtin.setup:

    - name: Enable CRB repository
      ansible.builtin.command:
        cmd: dnf config-manager --set-enabled crb
      changed_when: false

    - name: Install EPEL repositories
      ansible.builtin.dnf:
        name:
          - epel-release
          - epel-next-release
        state: present
        update_cache: true

    - name: Install base packages
      ansible.builtin.dnf:
        name:
          - firewalld
          - python3-firewall
          - python3-dbus
          - curl
          - htop
          - vim
          - nyx
          - iftop
          - vnstat
          - git
        state: present

    - name: Enable and start vnStat daemon
      ansible.builtin.systemd:
        name: vnstat
        enabled: true
        state: started

    - name: Check vnStat database
      ansible.builtin.command:
        cmd: vnstat --dbiflist
      register: vnstat_dbiflist
      changed_when: false
      failed_when: false

    - name: Add eth0 to vnStat database if missing
      ansible.builtin.command:
        cmd: vnstat --add -i eth0
      when: "'eth0' not in vnstat_dbiflist.stdout"
      failed_when: false

    - name: Restart vnStat after adding interface
      ansible.builtin.systemd:
        name: vnstat
        state: restarted

    - name: Enable and start firewalld
      ansible.builtin.systemd:
        name: firewalld
        enabled: true
        state: started

    - name: Allow SSH through firewall
      ansible.posix.firewalld:
        service: ssh
        permanent: true
        immediate: true
        state: enabled

    - name: Create admin user
      ansible.builtin.user:
        name: "{{ admin_user }}"
        groups: wheel
        append: true
        shell: /bin/bash
        create_home: true

    - name: Install SSH key for admin user
      ansible.posix.authorized_key:
        user: "{{ admin_user }}"
        key: "{{ admin_ssh_public_key }}"
        state: present

    - name: Allow wheel group passwordless sudo
      ansible.builtin.copy:
        dest: /etc/sudoers.d/90-wheel-nopasswd
        content: "%wheel ALL=(ALL) NOPASSWD: ALL\n"
        owner: root
        group: root
        mode: "0440"
        validate: "visudo -cf %s"
```
{% endraw %}

Run it like this:

```shell
ansible-playbook -i inventory.yml playbooks/init.yml
```

After that, switch your inventory to the user you actually want to keep. For example:

{% raw %}
```yaml
all:
  children:
    tor_exit:
      hosts:
        tor-exit-01:
          ansible_host: 203.0.113.10
          ansible_user: admin
          ansible_ssh_private_key_file: ~/.ssh/tor_exit_ed25519
```
{% endraw %}

## Configure Tor as an Exit Relay

The relay playbook is deliberately small. It installs Tor, cleans up unnecessary firewall exposure, opens the ORPort, and renders `torrc` from a template.

{% raw %}
```yaml
# playbooks/site.yml
---
- name: Configure Tor exit relay
  hosts: tor_exit
  become: true
  gather_facts: true

  tasks:
    - name: Install Tor
      ansible.builtin.dnf:
        name: tor
        state: present

    - name: Remove cockpit from firewall
      ansible.posix.firewalld:
        service: cockpit
        permanent: true
        immediate: true
        state: disabled

    - name: Remove dhcpv6-client from firewall
      ansible.posix.firewalld:
        service: dhcpv6-client
        permanent: true
        immediate: true
        state: disabled

    - name: Allow Tor ORPort through firewall
      ansible.posix.firewalld:
        port: "{{ tor_or_port }}/tcp"
        permanent: true
        immediate: true
        state: enabled

    - name: Deploy torrc
      ansible.builtin.template:
        src: ../templates/torrc.j2
        dest: /etc/tor/torrc
        owner: root
        group: root
        mode: "0644"
      notify: Restart tor

    - name: Enable and start Tor
      ansible.builtin.systemd:
        name: tor
        enabled: true
        state: started

  handlers:
    - name: Restart tor
      ansible.builtin.systemd:
        name: tor
        state: restarted
```
{% endraw %}

And the corresponding `torrc` template:

{% raw %}
```jinja
# templates/torrc.j2
## Managed by Ansible

Nickname {{ tor_nickname }}
ContactInfo {{ tor_contact_info }}

SocksPort 0
ORPort {{ tor_or_port }} IPv4Only
ServerDNSResolvConfFile /etc/tor/resolv.conf
HeartbeatPeriod 1 hour

ControlPort 127.0.0.1:9051
CookieAuthentication 1

ExitRelay 1

RelayBandwidthRate {{ tor_relay_bandwidth_rate }}
RelayBandwidthBurst {{ tor_relay_bandwidth_burst }}

{% if tor_exit_policy_mode == "reduced" %}
ReducedExitPolicy 1
{% elif tor_exit_policy_mode == "web_only" %}
ExitPolicy accept *:80
ExitPolicy accept *:443
ExitPolicy reject *:*
{% elif tor_exit_policy_mode == "custom" %}
{% for rule in tor_exit_policy_custom %}
ExitPolicy {{ rule }}
{% endfor %}
{% endif %}
```
{% endraw %}

I generally recommend starting with the `web_only` policy if you want a narrower operational footprint.

## Add a Local Resolver with Unbound

For an exit node, I prefer a local resolver instead of pushing DNS resolution elsewhere. This playbook installs Unbound, fetches root hints, prepares the DNSSEC trust anchor, validates the configuration, and points Tor to its own resolver file.

{% raw %}
```yaml
# playbooks/unbound.yml
---
- name: Configure local Unbound resolver for Tor exit
  hosts: tor_exit
  become: true
  gather_facts: true

  tasks:
    - name: Install Unbound and DNS tools
      ansible.builtin.dnf:
        name:
          - unbound
          - bind-utils
        state: present

    - name: Ensure Unbound state directory exists
      ansible.builtin.file:
        path: /var/lib/unbound
        owner: unbound
        group: unbound
        mode: "0750"
        state: directory

    - name: Download root hints
      ansible.builtin.get_url:
        url: https://www.internic.net/domain/named.cache
        dest: /etc/unbound/root.hints
        owner: root
        group: unbound
        mode: "0644"

    - name: Remove old misplaced trust anchor
      ansible.builtin.file:
        path: /etc/unbound/root.key
        state: absent

    - name: Prepare DNSSEC trust anchor
      ansible.builtin.command:
        cmd: unbound-anchor -a /var/lib/unbound/root.key
      register: unbound_anchor
      changed_when: false
      failed_when: unbound_anchor.rc not in [0, 1]

    - name: Set trust anchor permissions
      ansible.builtin.file:
        path: /var/lib/unbound/root.key
        owner: unbound
        group: unbound
        mode: "0644"

    - name: Deploy Unbound config
      ansible.builtin.template:
        src: ../templates/unbound.conf.j2
        dest: /etc/unbound/unbound.conf
        owner: root
        group: root
        mode: "0644"
      notify: Restart unbound

    - name: Restore SELinux context for Unbound files
      ansible.builtin.command:
        cmd: restorecon -Rv /etc/unbound /var/lib/unbound
      changed_when: false
      failed_when: false

    - name: Validate Unbound config
      ansible.builtin.command:
        cmd: unbound-checkconf /etc/unbound/unbound.conf
      changed_when: false

    - name: Enable and start Unbound
      ansible.builtin.systemd:
        name: unbound
        enabled: true
        state: started

    - name: Create Tor resolver file using local Unbound
      ansible.builtin.copy:
        dest: /etc/tor/resolv.conf
        owner: root
        group: root
        mode: "0644"
        content: |
          nameserver 127.0.0.1
          options edns0 trust-ad

    - name: Ensure Tor uses dedicated resolver file
      ansible.builtin.lineinfile:
        path: /etc/tor/torrc
        regexp: "^ServerDNSResolvConfFile "
        line: "ServerDNSResolvConfFile /etc/tor/resolv.conf"
        state: present
      notify: Restart tor

  handlers:
    - name: Restart unbound
      ansible.builtin.systemd:
        name: unbound
        state: restarted

    - name: Restart tor
      ansible.builtin.systemd:
        name: tor
        state: restarted
```
{% endraw %}

The matching Unbound template:

{% raw %}
```jinja
# templates/unbound.conf.j2
server:
    chroot: ""

    interface: 127.0.0.1
    port: 53

    access-control: 127.0.0.0/8 allow
    access-control: 0.0.0.0/0 refuse

    do-ip4: yes
    do-ip6: no
    do-udp: yes
    do-tcp: yes

    root-hints: "/etc/unbound/root.hints"
    auto-trust-anchor-file: "/var/lib/unbound/root.key"

    username: "unbound"
    directory: "/var/lib/unbound"

    hide-identity: yes
    hide-version: yes
    harden-glue: yes
    harden-dnssec-stripped: yes
    harden-referral-path: yes
    qname-minimisation: yes
    aggressive-nsec: yes
    minimal-responses: yes

    prefetch: yes
    prefetch-key: yes

    cache-min-ttl: 60
    cache-max-ttl: 86400

    log-queries: no
    log-replies: no
    verbosity: 1
```
{% endraw %}

## Harden SSH and Basic Services

I do not keep the default SSH posture on an internet-facing Tor host. This playbook disables root login and password authentication, limits forwarding features, and reduces brute-force tolerance.

{% raw %}
```yaml
# playbooks/ssh-hardening.yml
---
- name: Harden SSH access
  hosts: tor_exit
  become: true
  gather_facts: true

  tasks:
    - name: Disable root login and password auth
      ansible.builtin.copy:
        dest: /etc/ssh/sshd_config.d/99-tor-exit-hardening.conf
        owner: root
        group: root
        mode: "0644"
        content: |
          PermitRootLogin no
          PasswordAuthentication no
          KbdInteractiveAuthentication no
          PubkeyAuthentication yes

          AllowUsers admin
          MaxAuthTries 3
          MaxStartups 10:30:60
          LoginGraceTime 30
          X11Forwarding no
          AllowTcpForwarding no
          AllowAgentForwarding no
          PermitTunnel no

    - name: Validate sshd config
      ansible.builtin.command:
        cmd: sshd -t
      changed_when: false

    - name: Restart sshd
      ansible.builtin.systemd:
        name: sshd
        state: restarted
```
{% endraw %}

This service-hardening playbook removes one small but common bit of noise:

{% raw %}
```yaml
# playbooks/hardening-services.yml
---
- name: Disable unnecessary services
  hosts: tor_exit
  become: true
  gather_facts: true

  tasks:
    - name: Disable and mask rpcbind units
      ansible.builtin.systemd:
        name: "{{ item }}"
        enabled: false
        state: stopped
        masked: true
      loop:
        - rpcbind.service
        - rpcbind.socket
      failed_when: false

    - name: Verify rpcbind port is closed
      ansible.builtin.shell:
        cmd: "ss -tulpen | grep ':111' || true"
      register: rpcbind_check
      changed_when: false

    - name: Print rpcbind check
      ansible.builtin.debug:
        var: rpcbind_check.stdout_lines
```
{% endraw %}

## Add fail2ban

On a public VPS, this is still worth having:

{% raw %}
```yaml
# playbooks/fail2ban.yml
---
- name: Configure fail2ban for SSH
  hosts: tor_exit
  become: true
  gather_facts: true

  tasks:
    - name: Install fail2ban
      ansible.builtin.dnf:
        name:
          - fail2ban
          - fail2ban-firewalld
        state: present

    - name: Configure sshd jail
      ansible.builtin.copy:
        dest: /etc/fail2ban/jail.d/sshd.local
        owner: root
        group: root
        mode: "0644"
        content: |
          [sshd]
          enabled = true
          backend = systemd
          banaction = firewallcmd-ipset
          port = ssh
          maxretry = 3
          findtime = 10m
          bantime = 1h

    - name: Enable and start fail2ban
      ansible.builtin.systemd:
        name: fail2ban
        enabled: true
        state: restarted
```
{% endraw %}

## Maintenance and Verification

An exit node is not a “configure once and forget it” system. The maintenance playbook updates the host, reboots when required, and verifies that Tor and the firewall come back cleanly.

{% raw %}
```yaml
# playbooks/maintenance.yml
---
- name: Maintain Tor exit host
  hosts: tor_exit
  become: true
  gather_facts: true

  tasks:
    - name: Update all packages
      ansible.builtin.dnf:
        name: "*"
        state: latest
        update_cache: true

    - name: Check if reboot is required
      ansible.builtin.command:
        cmd: needs-restarting -r
      register: reboot_check
      failed_when: false
      changed_when: reboot_check.rc == 1

    - name: Print reboot status
      ansible.builtin.debug:
        var: reboot_check.stdout_lines

    - name: Reboot if required
      ansible.builtin.reboot:
        msg: "Reboot initiated by Ansible after package updates"
        reboot_timeout: 900
        connect_timeout: 20
        post_reboot_delay: 15
        test_command: "systemctl is-system-running || true"
      when: reboot_check.rc == 1

    - name: Wait for host connection after reboot
      ansible.builtin.wait_for_connection:
        timeout: 300
        delay: 5
      when: reboot_check.rc == 1

    - name: Ensure firewalld is enabled and running
      ansible.builtin.systemd:
        name: firewalld
        enabled: true
        state: started

    - name: Ensure Tor is enabled and running
      ansible.builtin.systemd:
        name: tor
        enabled: true
        state: started

    - name: Check Tor service
      ansible.builtin.command:
        cmd: systemctl is-active tor
      changed_when: false

    - name: Show Tor fingerprint
      ansible.builtin.command:
        cmd: cat /var/lib/tor/fingerprint
      changed_when: false

    - name: Show Tor ORPort listener
      ansible.builtin.shell:
        cmd: ss -tulpen | grep ':{{ tor_or_port }}'
      changed_when: false
```
{% endraw %}

And this tiny check playbook is useful when you just want a quick status read:

{% raw %}
```yaml
# playbooks/check.yml
---
- name: Check Tor relay status
  hosts: tor_exit
  become: true
  gather_facts: false

  tasks:
    - name: Check Tor service
      ansible.builtin.command:
        cmd: systemctl is-active tor
      changed_when: false

    - name: Show Tor fingerprint
      ansible.builtin.command:
        cmd: cat /var/lib/tor/fingerprint
      changed_when: false

    - name: Show firewall state
      ansible.builtin.command:
        cmd: firewall-cmd --list-all
      changed_when: false

    - name: Show Tor ORPort listener
      ansible.builtin.shell:
        cmd: ss -tulpen | grep ':{{ tor_or_port }}'
      changed_when: false
```
{% endraw %}

## Typical Run Order

Once the machine exists, the practical order is:

```shell
ansible-galaxy collection install -r requirements.yml
ansible-playbook -i inventory.yml playbooks/init.yml
ansible-playbook -i inventory.yml playbooks/site.yml
ansible-playbook -i inventory.yml playbooks/unbound.yml
ansible-playbook -i inventory.yml playbooks/ssh-hardening.yml
ansible-playbook -i inventory.yml playbooks/fail2ban.yml
ansible-playbook -i inventory.yml playbooks/hardening-services.yml
ansible-playbook -i inventory.yml playbooks/check.yml
```

For ongoing operations:

```shell
ansible-playbook -i inventory.yml playbooks/maintenance.yml
ansible-playbook -i inventory.yml playbooks/check.yml
```

## Final Notes

Running a Tor exit node is not just a packaging exercise.

You should expect abuse complaints, make sure your contact information is real, keep the host narrow in scope, and avoid mixing unrelated workloads onto it. But from a systems perspective, the basic shape is straightforward: bootstrap the OS, lock down SSH, expose only the ORPort, keep DNS local, and make updates boring.

That is exactly the kind of work Ansible is good at.
