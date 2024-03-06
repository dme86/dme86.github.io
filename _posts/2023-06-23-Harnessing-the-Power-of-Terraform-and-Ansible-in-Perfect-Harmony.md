---
title: Harnessing the Power of Terraform and Ansible in Perfect Harmony
layout: post
tags: [Ansible, Terraform]
---

## Introduction

At the beginning of my AWS journey, I relied on Ansible as my go-to solution for achieving "infrastructure as code" capabilities.
It amazed me how Ansible could effortlessly spin up essential AWS resources like EC2 instances, RDS databases, and S3 buckets.

However, as I delved deeper into complex projects, I encountered significant challenges in maintaining and managing dependencies within my Ansible configurations.
It became apparent that a more robust and scalable solution was needed, leading me to make a complete transition to terraform, which has served me well for several years.

While terraform provided me with a reliable and powerful provisioning tool, I soon discovered that addressing drift and grappling with HashiCorp Configuration Language complexity posed new hurdles - for example, it can be challenging for developers to become proficient in HCL.
Dependence of development teams on infrastructure teams can lead to increased time and financial costs, deviating from the DevOps philosophy due to the persistence of strong silos.
Additionally, as my projects expanded, I encountered limitations when attempting to configure changes across multiple AWS services using terraform modules.

<!-- more -->

## Technical example

Suppose you find yourself managing numerous S3 buckets within your AWS environment. If you provisioned these buckets using Terraform, chances are you either leveraged  [an existing module](https://github.com/terraform-aws-modules/terraform-aws-s3-bucket)  or created your own custom module incorporating the necessary S3 resources.

The first approach can lead to a tangled web of dependencies, creating a potential "dependency hell" scenario. This occurs when you have numerous nested and versioned modules, making it increasingly challenging to maintain control over your environment in the long run.
Imagine the scenario where you need to switch versions, only to discover that some of your essential modules are incompatible with each other. In such cases, you would need to resolve the issues in both modules, release newer versions using "git tag," and ensure that your root module is appropriately versioned.
The result? A chaotic and complex environment to navigate.

The following terraform example uses a [null_resource](https://registry.terraform.io/providers/hashicorp/null/latest/docs/resources/resource), which will be triggered if the **ID** of the resource 'bucket b' changes.
This means the *playbook* will be *triggered* and *configured* ***initially***.
You'll be able to change it afterwards, for example, from other Ansible repositories.

For instance, you could furnish your development teams with straightforward Ansible YAML files, **empowering** them to configure their infrastructure according to their requirements.
Naturally, you would supply them with customized Ansible IAM roles, adhering to the concept of limiting their [blast radius](https://en.wikipedia.org/wiki/Blast_radius) while simultaneously granting them as much *operational freedom* as possible.

```hcl
rovider "aws" {
  region = "eu-central-1"
}

resource "aws_s3_bucket" "b" {
  bucket = var.bucket_name

  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}

resource "null_resource" "ansible_provisioner" {
  # Use null_resource as a trigger for local-exec provisioner
  triggers = {
    s3_id = aws_s3_bucket.b.id
  }

  provisioner "local-exec" {
    command = "ansible-playbook -i 'localhost,' -c local playbook.yml --extra-vars 'bucket_name=${var.bucket_name}'"
  }
}
```

> You may be interested of how to modify config for multiple buckets
> on the fly with ansible and tagged resources. Therefore please read my [ansible
> article](https://dme86.github.io/2023/08/01/Write-an-Ansible-dynamic-inventory-for-AWS-S3/).

While your *initial* configuration can encompass various elements, I would recommend considering the design patterns early on. For instance, if you aim for global versioning enforcement,
which should remain unchanged by development teams, it's prudent to define such parameters here and restrict the Ansible roles utilized by development teams accordingly.

In essence, it's advisable to maintain the initial configuration as straightforward as possible.
In this scenario, infrastructure teams would manage configurations in their dedicated Ansible repository.

It's also possible to trigger another CI pipeline, such as an Ansible repository CI, from your Terraform CI.
In GitLab, the configuration for this would resemble the following:

```yaml
terraform_apply:
  stage: terraform
  script:
    - terraform init
    - terraform playn -out=tfplan
    - |
      if [ -n "$(terraform show -json tfplan | jq '.resource_changes[]')" ]; then
        terraform apply -auto-approve tfplan
        # Trigger CI in another repository if changes were made
        curl -X POST -F token=TOKEN -F ref=BRANCH https://gitlab.com/api/v4/projects/PROJECT_ID/trigger/pipeline
      else
        echo "No Terraform changes detected. Skipping deployment."
      fi
```
You should adhere to your organizational patterns while implementing what suits you best. I just wanted to ensure that I showcase some of the possibilities available to you.

Nevertheless, I'll provide you with an example **playbook.yml** so that you can experiment and explore:

{% raw %}
```yaml
---
- name: Create folders in AWS S3 Bucket
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Enable Versioning
      amazon.aws.s3_bucket:
        name: "{{ bucket_name }}"
        versioning: true
      register: result

    - name: Debug Output
      debug:
        var: result

    - name: Create folders in S3 bucket
      amazon.aws.s3_object:
        bucket: "{{ bucket_name }}"
        object: "{{ item }}"
        mode: create
      loop:
        - foo/
        - foo/subfolder1
        - foo/subfolder2
        - bar/
        - baz/
```
{% endraw %}

## Separation of concerns

The concept revolves around utilizing Terraform as the **provisioner** and Ansible for **configuration management**.
In this approach, we primarily use Terraform to create S3 buckets, ensuring proper  [tagging alignment with recommended practices](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/tagging-best-practices.html). Subsequently, the configuration of these buckets is handled seamlessly through Ansible.
While this approach may initially appear counterintuitive, trust me, it gradually reveals its inherent logic and ultimately simplifies your life and that of your developers.

If you're interested, please read my [ansible article](https://dme86.github.io/2023/08/01/Write-an-Ansible-dynamic-inventory-for-AWS-S3/); it will show you how to write a [dynamic inventory](https://docs.ansible.com/ansible/latest/inventory_guide/intro_dynamic_inventory.html) for S3 and how to utilize a playbook dealing with various AWS tags.

Indeed, it's remarkably straightforward! With just a few lines of YAML code, beloved by all developers, you can effortlessly configure your bucket(s).
The beauty of this approach extends beyond bucket configuration. You no longer need to worry about deploying infrastructure configurations on a global scale amidst intricate terraform scenarios.
Simply let Ansible handle the task at hand, allowing it to seamlessly fulfill its purpose.

By adopting this approach, we have not only gained effortless **control** over our environment but also **empowered** our development teams to handle infrastructure configuration independently.
We no longer need to struggle with cumbersome and maintenance-heavy large modules, saving us hours of tedious work.
Moreover, we have successfully achieved a clear [separation of concerns](https://en.wikipedia.org/wiki/Separation_of_concerns), allowing each tool to focus on its specific domain of expertise.
configured

## Conclusion

To me, this approach makes much more sense, both from a control-level perspective and in terms of its user-friendliness.
With this approach, your dedicated cloud team can take care of the infrastructure provisioning, allowing other teams to seamlessly configure their own resources. This eliminates the risk of drift and avoids unnecessary version releases of modules.
The result is a **streamlined process** that promotes collaboration and ensures that each team can efficiently manage their specific resources without any complications.

Additionally, onboarding developers becomes much easier when providing them with YAML examples instead of HCL code.
This way, they can quickly grasp the configuration concepts and start contributing to the infrastructure management effortlessly.
YAML's simplicity and readability contribute to a smoother learning curve, enabling developers to become productive in a shorter span of time.

Recently, a  [terraform provider for Ansible](https://github.com/ansible/terraform-provider-ansible)  was released, opening up new possibilities for *integration and collaboration* between these two powerful tools.

> It's not terraform versus Ansible; it is terraform and Ansible working together synergistically
