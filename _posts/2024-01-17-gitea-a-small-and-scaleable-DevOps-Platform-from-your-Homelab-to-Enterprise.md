---
title: Gitea - A Small and Scaleable DevOps Platform - From Your Homelab to Enterprise
layout: page
tags: [Tutorials]
---

What I appreciate in software is when it scales efficiently. I dislike overstretched goals and under-delivering on value.

In recent years, GitLab, for example, made numerous promises about features but struggled to deliver on many occasions. Notably, they still lack support for ARM64 (See [Epic](https://gitlab.com/groups/gitlab-org/-/epics/2370)).

Moreover, in most cases, I've observed that companies don't necessarily need an exhaustive feature set like GitLab's. What they often require is CI/CD, [Issues](https://docs.gitea.com/usage/automatically-linked-references), package management, [Renovate](https://docs.renovatebot.com/modules/platform/gitea/) or Webhooks, in addition to User Management.

With Gitea, I get all of this - and more. I can also run it on a Raspberry Pi or configure it for replication on larger machines.

In this article, I'll show you how I installed a simple Gitea test instance on a small server (1 CPU, 1GB RAM) and hosted a runner for CI/CD actions. All of this was set up in **~1h**. For demonstration purposes, I did not dive into TLS or backup topics, and OAuth2 is not included.

<!-- more -->


# Installation

I followed the [official documentation](https://docs.gitea.com/installation/install-from-binary) from Gitea and was able to access it on port 3000 within a few minutes. (You can also choose to run it in Kubernetes, install it via Docker, etc.)
![enter image description here](https://i.imgur.com/LF2RupW.png)


For simplicity and a lightweight installation, I chose an [SQLite3](https://www.sqlite.org/) Database.

The first user will be granted admin rights. The installation only took a few seconds, and the dashboard was displayed:
![enter image description here](https://i.imgur.com/Nx3hZiB.png)

I added my public SSH key to my user profile and made sure my `~/.ssh/config` was configured to represent the new server, like:

    Host IP/HOST
        User git
        Hostname IP/HOST
        PreferredAuthentications publickey
	IdentityFile ~/.ssh/me.daniel.meier

I then added a new organization, and within it, a new repository. As you can see, there are numerous options available, including the ability to use a template for our repository, for example:
![enter image description here](https://i.imgur.com/HzQVzqW.png)
![enter image description here](https://i.imgur.com/9of0imS.png)
![enter image description here](https://i.imgur.com/sxjjrgg.png)

With the repository in place, my public key added, and my `~/.ssh/config` configured, I was now able to follow the steps to make the first commit:
![enter image description here](https://i.imgur.com/UyxGe9p.png)

And in the dashboard, everything was displayed as well—perfect!
![enter image description here](https://i.imgur.com/t8PVicv.png)



# Runner (CI/CD)

Starting a runner for CI/CD processes is extremely simple. For demonstration purposes, just follow the steps outlined in the [documentation](https://docs.gitea.com/usage/actions/act-runner).
After enabling the actions in the repo settings, I registered my demo runner as a global runner:
![enter image description here](https://i.imgur.com/lBdDXeZ.png)
![enter image description here](https://i.imgur.com/R36xWOd.png)

Inside my repository, I created the following file:

    .gitea/workflows/demo.yaml

```yaml
name: Gitea Actions Demo
run-name: ${{ gitea.actor }} is testing out Gitea Actions 🚀
on: [push]

jobs:
  Explore-Gitea-Actions:
    runs-on: ubuntu-latest
    steps:
      - run: echo "🎉 The job was automatically triggered by a ${{ gitea.event_name }} event."
      - run: echo "🐧 This job is now running on a ${{ runner.os }} server hosted by Gitea!"
      - run: echo "🔎 The name of your branch is ${{ gitea.ref }} and your repository is ${{ gitea.repository }}."
      - name: Check out repository code
        uses: actions/checkout@v3
      - run: echo "💡 The ${{ gitea.repository }} repository has been cloned to the runner."
      - run: echo "🖥️ The workflow is now ready to test your code on the runner."
      - name: List files in the repository
        run: |
          ls ${{ gitea.workspace }}
      - run: echo "🍏 This job's status is ${{ job.status }}."
```

As my code was pushed to the repository, I checked the runner's output in my terminal:
![enter image description here](https://i.imgur.com/d77wmzE.png)

And the process was visible from the repository as well:
![enter image description here](https://i.imgur.com/ZaEZltF.png)
![enter image description here](https://i.imgur.com/lNoW8rb.png)
![enter image description here](https://i.imgur.com/U1UR78C.png)
![enter image description here](https://i.imgur.com/nJlvsAw.png)

# Enterprise

To run such a setup in an enterprise scenario, I would recommend ensuring a robust backup strategy (testing regularly is crucial) and staying vigilant about version updates. Additionally, always implement TLS, for instance, with an Nginx reverse proxy, and maintain control over user management through [OAuth2](https://docs.gitea.com/development/oauth2-provider). Keep a close eye on right-sizing your server to optimize costs.

# Conclusion


I've only scratched the surface here, but it should give you a glimpse of what is possible with Gitea.
It offers many more features needed on a daily basis, such as [linking references or closing an issue via commit or PR](https://docs.gitea.com/usage/automatically-linked-references). Please [refer to their documentation](https://docs.gitea.com/) for more information.

IT is changing permanently, but one thing has stayed the same over all the years working in this field, and that is the emphasis on reducing costs. If you have commitments to licenses, such as with GitLab or Slack, it can be challenging to reduce them, and often, you end up paying (a lot!) for features you don't need.

For me, Gitea is a simple yet powerful and highly scalable solution. Easy to maintain and with no licensing costs, it provides a cost-efficient way to grow with it.
