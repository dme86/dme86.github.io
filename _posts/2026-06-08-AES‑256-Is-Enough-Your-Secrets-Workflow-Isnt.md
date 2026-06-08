---
title: AES‑256 Is Enough. Your Secrets Workflow Isn’t
layout: post
tags: [Linux, Security]
---


There is a strange little ritual in engineering teams.

Someone mentions encryption, someone else says “AES‑256,” and for a brief second the room relaxes. The magic number has been spoken. The vault door has appeared. The dragon is asleep.

Then the same team commits a decrypted `.env` file to Git.
Or stores an age private key in a shared password note.
Or lets CI print a production secret into a build log.
Or keeps the only decryption key on one developer laptop, guarded by vibes, hope, and an unpaid backup plan.

The uncomfortable truth is this:
AES‑256 is usually not the weak point.
Your workflow is.

<!-- more -->

## The SOPS and age use case

This becomes very real in modern DevOps and GitOps setups.

Tools like SOPS and age exist because teams want to keep configuration close to code without spraying plaintext secrets all over Git. SOPS is an editor for encrypted files and supports formats such as YAML, JSON, ENV, INI, and binary files. It can use backends such as age, PGP, AWS KMS, GCP KMS, Azure Key Vault, HashiCorp Vault, and OpenBao. SOPS keeps the structure of configuration files visible while encrypting values, and its own documentation says values are encrypted using AES‑256 in GCM mode. ([getsops.io](https://getsops.io/))

age is a modern file encryption tool and format with small explicit keys, UNIX-style composability, and support for recipient-based encryption. In other words: encrypt to one or more public recipients, decrypt with the corresponding private identity. ([github.com/FiloSottile/age](https://github.com/FiloSottile/age))

That is a very practical setup:

```text
Git stores encrypted secrets.
Developers can review structure without seeing plaintext.
CI/CD decrypts only where needed.
Access is managed through explicit identities or KMS permissions.
```

That sounds sane.
And it can be sane.
But only if the surrounding workflow is sane too.

## AES‑256 itself is not the problem

AES, the Advanced Encryption Standard, is a symmetric block cipher standardized by NIST. AES supports 128, 192, and 256-bit keys and encrypts data in 128-bit blocks. AES‑256 simply means AES with a 256-bit key. ([NIST FIPS 197](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197-upd1.pdf))

A 256-bit key space contains:

```text
2^256
```

possible keys.
That is about:

```text
116 quattuorvigintillion possible keys
```

A billion has 9 zeros.
A trillion has 12 zeros.
This number has 78 digits.

Written out, it is:

```text
115,792,089,237,316,195,423,570,985,008,687,907,853,269,984,665,640,564,039,457,584,007,913,129,639,936
```

At this scale, the exact name of the number almost stops helping. The point is simpler: there are so many possible AES‑256 keys that brute force is not an engineering plan. It is bedtime theatre for impatient supercomputers.

## A classical brute-force attack is absurd

Let’s pretend an attacker has a machine that can try:

```text
10^18 keys per second
```

That is one quintillion key attempts per second.
At that speed, searching the full AES‑256 key space would take roughly:

```text
3.67 × 10^51 years
```

The universe is about:

```text
1.38 × 10^10 years old
```

So this is not “a long time.”
This is “the heat death of your roadmap happened before the progress bar moved.”

## But what about quantum computers?

Quantum computers do change the discussion, but not in the way many headlines suggest.

For symmetric key search, [Grover’s algorithm](https://en.wikipedia.org/wiki/Grover%27s_algorithm) can theoretically provide a quadratic speedup. Instead of searching through `N` possibilities, an idealized quantum search needs roughly:

```text
√N
```

For a 256-bit key space:

```text
√(2^256) = 2^128
```

That is where the common statement comes from:

```text
AES‑256 has roughly 128-bit security against idealized quantum brute force.
```

That sounds scary until you look at what `2^128` means:

```text
340,282,366,920,938,463,463,374,607,431,768,211,456
```

Still enormous.

NIST’s post-quantum FAQ is much calmer than the mythology. NIST says Grover’s algorithm gives a quadratic speedup *in theory*, but also notes that quantum hardware is likely to be expensive, that Grover is hard to parallelize efficiently, and that AES‑192 and AES‑256 are expected to remain safe for a very long time. ([NIST Post-Quantum Cryptography FAQ](https://csrc.nist.gov/projects/post-quantum-cryptography/faqs))

So no: a future quantum computer does not magically turn AES‑256 into wet cardboard.

## How long would 2^128 attempts take?

Assume an attacker somehow needs to perform `2^128` useful attempts.

| Attempts per second | Time needed for 2^128 attempts |
|---:|---:|
| `10^9/s` | about `1.08 × 10^22` years |
| `10^12/s` | about `1.08 × 10^19` years |
| `10^18/s` | about `1.08 × 10^13` years |
| `10^24/s` | about `10.8 million` years |
| `10^30/s` | about `10.8 years` |

The last line looks scary.

But `10^30` useful cryptographic search steps per second is not “a large GPU cluster.”

It is not a few racks in a data center.
It is not even “someone at AWS got a very spicy invoice.”
It is **fantasy**-scale computing.

## Compare that to the fastest supercomputer

As a reality anchor, take El Capitan.

In the November 2025 TOP500 list, El Capitan was listed as the world’s fastest supercomputer, with an HPL benchmark result of **1.809 exaflop/s**, **11.34 million cores**, and a power draw of **29,685 kW**, roughly **29.7 MW**. ([TOP500 November 2025](https://top500.org/lists/top500/2025/11/))

Now let’s be outrageously generous.
Let’s pretend that:

```text
1 floating-point operation = 1 useful AES key attempt
```

That is not how real AES brute force works, and it is especially not how quantum search works. But as a rough scale comparison, it is generous enough to help the intuition.

At El Capitan’s `1.809 × 10^18` operations per second, even the reduced quantum-style `2^128` search space would take roughly:

```text
5.96 × 10^12 years
```

That is about:

```text
5.96 trillion years
```

So even after giving the attacker the quantum “128-bit effective” framing, and even after pretending the world’s fastest supercomputer is a perfect AES guessing machine, the answer is still trillions of years.

The machine is fast.
The number is ridiculous.

## What would 10^30 attempts per second mean?

Now take the scary table entry:

```text
10^30 attempts per second
```

Compared to El Capitan:

```text
10^30 / 1.809 × 10^18 ≈ 552,800,000,000
```

So you would need roughly:

```text
553 billion El Capitan-class systems
```

Again, this is a crude comparison. FLOPS are not AES attempts. Classical supercomputers are not quantum computers. But that actually makes the point stronger: even with a fantasy-friendly comparison, the scale is *deranged*.

Power consumption would be equally absurd.

One El Capitan-class system draws about:

```text
29.7 MW
```

Scale that to 553 billion systems:

```text
≈ 16,400,000 TW
```

That is:

```text
16.4 million terawatts
```

And if electricity cost only:

```text
$0.10 per kWh
```

then running that fantasy machine would cost roughly:

```text
$1.64 quadrillion per hour
```

At:

```text
$0.30 per kWh
```

it would be roughly:

```text
$4.92 quadrillion per hour
```

That is not a data center.
That is not even an energy policy.
That is a planet trying to become a space heater.

## Quantum does not mean free

And the quantum version is not easier in practice.

You do not just replace 553 billion supercomputers with one glowing quantum cube and call it done.

A serious Grover-style attack against AES would require fault-tolerant quantum computing, logical qubits, quantum error correction, enormous gate depth, control hardware, cooling infrastructure, and a level of reliability that does not resemble today’s noisy quantum machines. Research on applying Grover’s algorithm to AES focuses exactly on these resource questions: qubits, circuit depth, gate counts, and the cost of implementing AES inside a quantum circuit. ([arXiv:1512.04965](https://arxiv.org/abs/1512.04965))

That is the gap between theory and practice.
Theory says:

```text
Grover reduces exhaustive search from 2^256 to roughly 2^128.
```

Practice says:
```text
Good luck building the machine, powering it, cooling it, error-correcting it, and running the full attack before civilization changes ticketing systems again.
```

## The boring attacks are the real attacks

If you use SOPS and age, the real risks are much less cinematic.
They look like this:

```text
A decrypted secrets file committed by accident.
An age private identity copied into Slack.
A CI job decrypting secrets for untrusted pull requests.
A debug command printing environment variables.
A KMS policy granting access too broadly.
A backup system storing plaintext copies.
An engineer leaving the company while still listed as a recipient.
A production secret living forever because nobody owns rotation.
```

None of these attacks break AES‑256.
They walk around it.
They steal the plaintext before encryption or after decryption.
That is the little goblin door in the castle wall.

## What a sane SOPS + age workflow should care about

The important questions are operational:

```text
Who can decrypt production secrets?
Where are private identities stored?
Are they backed up?
Are they encrypted at rest?
Can CI decrypt only on protected branches?
Can forked pull requests ever access plaintext secrets?
Are old recipients removed when people leave?
Are secrets rotated after exposure?
Do logs ever contain decrypted values?
Can you rebuild the system if one laptop dies?
Can you prove which key material protects which environment?
```

This is where the real engineering lives.

AES‑256 gives you a very strong locked box.

But someone still has to decide where the key goes, who can touch it, how it is rotated, how it is backed up, and how it is prevented from ending up in the worst possible chat thread at 17:48 on a Friday.

## The quantum panic is mostly misplaced

Quantum computing is a serious field.

Post-quantum migration is serious too, especially for public-key cryptography such as RSA and elliptic-curve systems.
But symmetric encryption is not in the same panic category.

For AES, the practical message is much calmer:

```text
AES‑256 is not the part you should be losing sleep over.
```

If your attacker can read your decrypted Kubernetes Secret from a build artifact, they do not need a quantum computer.

If your production `.env` file is sitting in someone’s Downloads folder, they do not need Grover’s algorithm.

If your age identity is copied into a wiki page, they do not need cryptanalysis.

They need search.

## The real takeaway

AES‑256 is enough.

The hard part is not making ciphertext strong.
The hard part is making plaintext rare.

A good secrets workflow should make decrypted secrets temporary, intentional, auditable, minimal, and boring.

SOPS and age can help with that. They are not magic. They are sharp tools. Used well, they let teams store encrypted secrets in Git without pretending Git is a vault. Used badly, they become one more ritual around a private key that everyone is too afraid to touch and nobody knows how to recover.

So yes:

```text
AES‑256 is enough.
```

But that sentence is incomplete.

The better version is:

```text
AES‑256 is enough.
Your secrets workflow has to be good enough too.
```

