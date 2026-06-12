---
title: "Your .env File Does Not Belong in Plaintext"
description: "How to keep .env files in Git with SOPS and age without turning your secrets workflow into a liability."
layout: post
date: 2026-06-12 09:30:00 +0200
tags: [Linux, Security, DevOps]
---

In an earlier article, [AES‑256 Is Enough. Your Secrets Workflow Isn’t](https://dme86.github.io/2026/06/08/AES%E2%80%91256-Is-Enough-Your-Secrets-Workflow-Isnt/), I argued that the cipher is usually not the weak point.

The weak point is the workflow around it.

One of the most common examples is the humble `.env` file.

<!-- more -->

Teams know that a plaintext `.env` file should not live in a public Git repository.
So they do one of four things:

- keep it out of Git entirely and pass it around in chat
- commit `.env.example` and manage the real values manually on every machine
- store the real `.env` in a private repo and call that “good enough”
- commit the actual `.env` by accident and have a very educational afternoon

None of that scales particularly well.

If you want a better model, use [SOPS](https://getsops.io/) with [age](https://github.com/FiloSottile/age) and treat the encrypted `.env` file as a normal repository artifact.

That gives you something much closer to a sane workflow:

- the encrypted file can live in Git, even in a public repository
- developers decrypt only when needed
- CI can decrypt with its own identity
- access is managed by explicit recipients
- offboarding has a real procedure instead of a prayer

## What SOPS and age Actually Buy You

SOPS is not just “file encryption.”

It gives you a manageable way to keep structured secret material in version control while encrypting the values. age gives you a clean recipient-based key model: encrypt to one or more public keys, decrypt with the matching private identities.

That matters because it changes the team workflow from this:

```text
Who has the latest .env?
Can someone DM it to me?
Which copy is current?
Did CI use the same one?
Who else has it?
```

into this:

```text
The encrypted .env lives in Git.
Authorized people can decrypt it.
Unauthorized people cannot.
Changes are reviewed like normal config changes.
Recipient access is explicit.
```

That is a much more adult operating model.

## Do Not Name the Encrypted File `.env`

This is a small but important opinion.

Do not keep the encrypted file as `.env` if tools in your repository auto-load `.env` files. That is an easy way to confuse humans and automation.

Use something like:

```text
secrets/app.env
secrets/app.env.enc
```

or:

```text
env/app.env.sops
```

The exact naming does not matter much.
What matters is that the encrypted artifact is obviously encrypted and not accidentally consumed as plaintext.

## Generate age Identities

Each team member should have their own age identity.

That means:

- each person keeps their own private key
- the repository only needs their public recipient
- access can be granted and revoked per person

Generating a key is straightforward:

```shell
age-keygen -o ~/.config/sops/age/keys.txt
```

That file contains the private identity.
The corresponding public recipient looks like this:

```text
age1exampleexampleexampleexampleexampleexampleexampleexample
```

That recipient is what gets added to the repository configuration.

## A Minimal Repository Layout

A simple setup might look like this:

```text
.
├── .sops.yaml
├── Makefile
├── secrets/
│   └── app.env
└── scripts/
    └── run-with-env.sh
```

The important pieces are:

- `.sops.yaml` to define who can decrypt
- an encrypted `.env`-style file in `secrets/`
- a safe command path to decrypt or run processes with that file

## Example `.sops.yaml`

This is the core policy file:

```yaml
creation_rules:
  - path_regex: secrets/.*\.env$
    age: >-
      age1aliceexampleexampleexampleexampleexampleexamplex,
      age1bobexampleexampleexampleexampleexampleexamplexxx,
      age1ciexampleexampleexampleexampleexampleexamplexxxx
```

This says:

- files matching `secrets/*.env` should be encrypted with SOPS
- Alice, Bob, and CI can decrypt them

That alone is already better than one shared team password.

## Create the Encrypted `.env`

Start with a normal plaintext file once, locally:

```dotenv
DATABASE_URL=postgres://app:secret@db.internal/app
REDIS_URL=redis://cache.internal:6379/0
JWT_SECRET=replace-me
```

Then encrypt it in place:

```shell
sops --encrypt --in-place secrets/app.env
```

Now the repository holds the encrypted version, not the plaintext one.

From that point on, editing should also go through SOPS:

```shell
sops secrets/app.env
```

That opens the file in your editor, decrypts it temporarily, and writes back the encrypted result when you save.

## A Makefile Workflow

A small Makefile is often enough to keep the workflow pleasant:

```make
SOPS_FILE := secrets/app.env
PLAIN_FILE := .env.local

.PHONY: decrypt edit run clean

decrypt:
	sops --decrypt $(SOPS_FILE) > $(PLAIN_FILE)
	chmod 600 $(PLAIN_FILE)

edit:
	sops $(SOPS_FILE)

run:
	sops --decrypt $(SOPS_FILE) > $(PLAIN_FILE)
	chmod 600 $(PLAIN_FILE)
	env $$(grep -v '^#' $(PLAIN_FILE) | xargs) ./scripts/run-with-env.sh
	rm -f $(PLAIN_FILE)

clean:
	rm -f $(PLAIN_FILE)
```

This is decent, but it still writes a temporary plaintext file to disk.

That may be acceptable on some systems, but it is not my favorite model.

## A Better Option Than the Makefile Target

The cooler approach is to avoid writing a decrypted `.env` file at all.

SOPS can execute a command with decrypted environment variables directly.

That is worth spelling out clearly.

The earlier `make decrypt` style workflow does this:

1. decrypt the secret file
2. write the plaintext values into a local file such as `.env.local`
3. start your command using that file
4. hopefully delete the file afterwards

That works, but it creates a small plaintext window on disk.

Even if the file only exists for a few seconds, it still existed:

- it could be left behind if the command crashes
- it could be picked up by a sloppy backup rule
- it could be committed by accident
- another person on the same machine might notice it
- you now depend on cleanup discipline

`sops exec-env` works differently.

It decrypts the file in memory, injects the values into the environment of one child process, starts that process, and then the decrypted values disappear with that process.

In simpler words:

- no `.env.local`
- no `cat > file`
- no “remember to delete it later”
- just one command that gets the secret values for as long as it runs

That is usually the cleaner and safer default.

For example:

```shell
sops exec-env secrets/app.env 'env | rg DATABASE_URL'
```

This command does **not** create a plaintext `.env` file in your repository.

It temporarily decrypts `secrets/app.env`, starts a shell command, and makes variables such as `DATABASE_URL` available only to that command.

Or for an actual app:

```shell
sops exec-env secrets/app.env './scripts/run-with-env.sh'
```

That means your application sees the decrypted environment variables, but your working tree does not suddenly contain a readable secret file.

If you are trying to explain this to someone on the team, the comparison is basically this:

```text
make decrypt:
  "write the secret to disk, use it, then delete it"

sops exec-env:
  "never write the secret to disk, only hand it to the process that needs it"
```

That is the reason I prefer it.

That is usually better than `make decrypt` because:

- no lingering plaintext `.env` file sits in the repository
- there is less cleanup to forget
- the decrypted data exists only for the child process

If you still want a Makefile wrapper, make it call `exec-env`:

```make
SOPS_FILE := secrets/app.env

.PHONY: edit run shell

edit:
	sops $(SOPS_FILE)

run:
	sops exec-env $(SOPS_FILE) './scripts/run-with-env.sh'

shell:
	sops exec-env $(SOPS_FILE) 'sh'
```

That gives you convenience without normalizing plaintext secret files on disk.

## Example Application Script

Your app runner can stay simple:

```shell
#!/bin/sh
set -eu

exec docker compose up
```

Then:

```shell
make run
```

or directly:

```shell
sops exec-env secrets/app.env 'docker compose up'
```

That is a much nicer workflow than “decrypt this manually, hope you remember to delete it later.”

## CI/CD Identities

One of the cleanest parts of this model is that CI does not need a shared developer key.

CI should get its own age identity or another decryption backend appropriate for the environment. If you are using age directly, the runner receives its private identity securely through the CI secret store and SOPS uses it at runtime.

That means:

- developers have their own identities
- CI has its own identity
- you do not need one magical all-powerful key on every machine

That separation becomes important the moment you need to revoke access.

## Offboarding a Team Member

This is where many teams get sloppy.

If someone leaves, it is not enough to say:

```text
We removed them from the repository.
```

That does **not** revoke their ability to decrypt a file that was already encrypted to their age recipient.

You need to do at least two separate things.

### 1. Remove their recipient and re-encrypt the file

Update `.sops.yaml` and remove their age recipient:

```yaml
creation_rules:
  - path_regex: secrets/.*\.env$
    age: >-
      age1aliceexampleexampleexampleexampleexampleexamplex,
      age1ciexampleexampleexampleexampleexampleexamplexxxx
```

Then re-encrypt the file so the departed user is no longer a recipient:

```shell
sops updatekeys -y secrets/app.env
```

That changes who can decrypt the repository version **from now on**.

### 2. Rotate the actual secret values

This is the part people love to skip.

If that person ever had legitimate access, they may already know:

- database passwords
- JWT signing secrets
- API tokens
- SMTP credentials
- anything else that was inside the file

So just removing their age recipient is not enough.

You must rotate the secrets themselves:

- issue new database credentials
- replace API tokens
- rotate signing keys where necessary
- update CI and deployment targets
- commit the re-encrypted file with the new values

If you do not rotate the underlying values, you are only preventing future decryption of the file artifact. You are not undoing knowledge that already left with the person.

That distinction matters a lot.

## A Useful Offboarding Sequence

In practice, I would handle it in this order:

1. Remove the person’s recipient from `.sops.yaml`.
2. Generate replacement credentials for everything in the `.env`.
3. Edit the secret file via `sops`.
4. Run `sops updatekeys -y secrets/app.env`.
5. Deploy the new values everywhere they are used.
6. Invalidate the old credentials.

That is the actual offboarding workflow.

Anything less is mostly theatre.

## Common Mistakes

The usual failure modes are boring:

- committing the decrypted `.env` by mistake
- sharing one age private key across the whole team
- leaving a plaintext `.env` on CI runners
- forgetting to rotate real secrets after offboarding
- encrypting secrets properly but then printing them in logs
- storing the only age private key in one developer home directory

Again, this is the same basic lesson as in the AES article:

The crypto is usually not the embarrassing part.
The surrounding habits are.

## Closing Thoughts

SOPS and age give you a very practical middle ground.

You do not need to keep secrets completely outside Git.
You do not need to pretend private repositories are secret stores.
And you do not need to pass `.env` files around like contraband.

Keep the encrypted file in the repository.
Use explicit recipients.
Prefer `sops exec-env` over writing plaintext files when possible.
And when someone leaves the team, remove their recipient **and** rotate the actual secret values.

That is what a sane `.env` workflow looks like.
