---
layout: post
title: Harnessing the Power of Terraform and Ansible in Perfect Harmony
---

## Introduction

At the beginning of my AWS journey, I relied on Ansible as my go-to solution for achieving "infrastructure as code" capabilities. It amazed me how Ansible could effortlessly spin up essential AWS resources like EC2 instances, RDS databases, and S3 buckets.

However, as I delved deeper into complex projects, I encountered significant challenges in maintaining and managing dependencies within my Ansible configurations. It became apparent that a more robust and scalable solution was needed, leading me to make a complete transition to terraform, which has served me well for several years.

While terraform provided me with a reliable and powerful provisioning tool, I soon discovered that addressing drift and grappling with HashiCorp Configuration Language complexity posed new hurdles - for example, it can be challenging for developers to become proficient in HCL. Additionally, as my projects expanded, I encountered limitations when attempting to configure changes across multiple AWS services using terraform modules.

## Technical example

Suppose you find yourself managing numerous S3 buckets within your AWS environment. If you provisioned these buckets using Terraform, chances are you either leveraged  [an existing module](https://github.com/terraform-aws-modules/terraform-aws-s3-bucket)  or created your own custom module incorporating the necessary S3 resources.

The first approach can lead to a tangled web of dependencies, creating a potential "dependency hell" scenario. This occurs when you have numerous nested and versioned modules, making it increasingly challenging to maintain control over your environment in the long run. Imagine the scenario where you need to switch versions, only to discover that some of your essential modules are incompatible with each other. In such cases, you would need to resolve the issues in both modules, release newer versions using "git tag," and ensure that your root module is appropriately versioned. The result? A chaotic and complex environment to navigate.

## Separation of concerns

The concept revolves around utilizing Terraform as the provisioner and Ansible for configuration management. In this approach, we primarily use Terraform to create S3 buckets, ensuring proper  [tagging alignment with recommended practices](https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/tagging-best-practices.html). Subsequently, the configuration of these buckets is handled seamlessly through Ansible. While this approach may initially appear counterintuitive, trust me, it gradually reveals its inherent logic and ultimately simplifies your life and that of your developers.

As an example, Ansible enables you to configure all buckets that possess specific tags. For instance:

```yaml
--
- name: Enable versioning for S3 buckets
  hosts: localhost
  gather_facts: false
  tasks:
    - name: Get S3 bucket list
      community.aws.aws_s3_bucket_info:
        region: "us-east-1"  # Replace with the appropriate region
        tags:
          - "team:foo"
          - "stage:bar"
      register: s3_buckets


    - name: Enable versioning for matching buckets
      community.aws.aws_s3_bucket_versioning:
        bucket: "{{ item.name }}"
        status: enabled
        region: "us-east-1"  # Replace with the appropriate region
      loop: "{{ s3_buckets.buckets }}"
  ````

This Ansible script automates the process of enabling versioning for AWS S3 buckets. It retrieves information about S3 buckets with specific tags ("team:foo" and "stage:bar") using the  **aws_s3_bucket_info**  module. The script then enables versioning for each matching bucket using the  **aws_s3_bucket_versioning**  module.

Indeed, it's remarkably straightforward! With just a few lines of YAML code, beloved by all developers, you can effortlessly configure your bucket(s). The beauty of this approach extends beyond bucket configuration. You no longer need to worry about deploying infrastructure configurations on a global scale amidst intricate terraform scenarios. Simply let Ansible handle the task at hand, allowing it to seamlessly fulfill its purpose.

By adopting this approach, we have not only gained effortless control over our environment but also empowered our development teams to handle infrastructure configuration independently. We no longer need to struggle with cumbersome and maintenance-heavy large modules, saving us hours of tedious work. Moreover, we have successfully achieved a clear separation of concerns, allowing each tool to focus on its specific domain of expertise.

## Conclusion

To me, this approach makes much more sense, both from a control-level perspective and in terms of its user-friendliness. With this approach, your dedicated cloud team can take care of the infrastructure provisioning, allowing other teams to seamlessly configure their own resources. This eliminates the risk of drift and avoids unnecessary version releases of modules. The result is a streamlined process that promotes collaboration and ensures that each team can efficiently manage their specific resources without any complications.

Additionally, onboarding developers becomes much easier when providing them with YAML examples instead of HCL code. This way, they can quickly grasp the configuration concepts and start contributing to the infrastructure management effortlessly. YAML's simplicity and readability contribute to a smoother learning curve, enabling developers to become productive in a shorter span of time.

Recently, a  [terraform provider for Ansible](https://github.com/ansible/terraform-provider-ansible)  was released, opening up new possibilities for integration and collaboration between these two powerful tools.

> It's not terraform versus Ansible; it is terraform and Ansible working together synergistically
