---
layout: post
title: Write an Ansible dynamic inventory for AWS S3
---

You may have already read my [former article](https://dme86.github.io/2023/06/23/Harnessing-the-Power-of-Terraform-and-Ansible-in-Perfect-Harmony/), which describes how to use Terraform **together** with Ansible.

In this article, I will show you how you can enhance your setup further by writing your own [(dynamic) inventory](https://docs.ansible.com/ansible/latest/dev_guide/developing_inventory.html) file for S3 buckets in Ansible.

Of course, you can create additional inventories; for instance, for Amazon RDS, the fundamentals remain the same, and the process is quite easy and straightforward as well. In this article, I will be utilizing [Ansible Galaxy AWS](https://galaxy.ansible.com/ui/repo/published/amazon/aws/).

# aws_s3_inventory.py

Create a file, called **aws_s3_inventory.py**, paste this code:

```python
#!/usr/bin/python


import boto3
import json


# Create S3 client
s3 = boto3.client('s3')


# Fetch list of S3 bucket names
response = s3.list_buckets()


# Create inventory dictionary
inventory = {
    '_meta': {
        'hostvars': {}
    },
    'all': {
        'hosts': []
    }
}


# Fetch tags for each bucket; include them in the inventory
for bucket in response['Buckets']:
    bucket_name = bucket['Name']
    inventory['all']['hosts'].append(bucket_name)
    inventory['_meta']['hostvars'][bucket_name] = {
        'tags': {}
    }


    # Fetch tags for current bucket
    tags_response = s3.get_bucket_tagging(Bucket=bucket_name)
    if 'TagSet' in tags_response:
        for tag in tags_response['TagSet']:
            inventory['_meta']['hostvars'][bucket_name]['tags'][tag['Key']] = tag['Value']


# Output inventory in JSON format
print(json.dumps(inventory))
```

make it executable:

```shell
chmod +x aws_s3_inventory.py
```

If you now run it (`./aws_s3_inventory.py | jq`), you should see an similar output to:

```json
{
   "_meta": {
        "hostvars": {
            "example-bucket1": {
                "tags": {
                    "foo": "bar",
                    "owner": "ansible"
                }
            },
            "example-bucket2": {
                "tags": {
                    "foo": "bar",
                    "owner": "ansible"
                }
            }
        }
    },
    "all": {
        "hosts": ["example-bucket1", "example-bucket2"]
    }
}
```

You are now able to use **tags** to filter and perform tasks on specific S3 buckets based on their attributes.

Example playbook:
{% raw %}
```yaml
---
- name: Example S3 bucket tasks
  hosts: all
  connection: local
  gather_facts: no


  tasks:
    - name: Show tags of the S3 bucket
      debug:
        var: hostvars[inventory_hostname].tags

    # Add your tasks here, specific to different environments.
    # For example, you can use "when" conditionals to run tasks based on the "Environment" tag:
    - name: Task for Development environment
      debug:
       msg: "Performing tasks for Development environment"
      when: hostvars[inventory_hostname].tags.Environment == "Dev"

    # This example ensures versioning is 'false' for all Buckets with the Environment tag 'Dev'
    - name: Disable versioning for S3 buckets in the Dev environment
      s3_bucket:
        name: "{{ inventory_hostname }}"
        versioning: false
      when: hostvars[inventory_hostname].tags.Environment == "Dev"

    # Do some tasks for all Buckets with the Environment tag 'Prod'
    - name: Task for Production environment
      debug:
       msg: "Performing tasks for Production environment"
      when: hostvars[inventory_hostname].tags.Environment == "Prod"

```
{% endraw %}

For simple testing you could call ansible like:

```shell
ansible-playbook -i aws_s3_inventory.py s3_bucket_tasks.yml
```

Output would look like this:

```shell
PLAY [Example S3 bucket tasks] ********************************************************************************************************************************

TASK [Show tags of the S3 bucket] *****************************************************************************************************************************
ok: [testing-dme-demo-bucket] => {
    "hostvars[inventory_hostname].tags": {
        "Environment": "Dev",
        "Name": "My bucket"
    }
}
ok: [this-is-an-a-w-s-ome-bucket-name] => {
    "hostvars[inventory_hostname].tags": {
        "Environment": "Dev",
        "Name": "My bucket"
    }
}

TASK [Task for Development environment] ***********************************************************************************************************************
ok: [testing-dme-demo-bucket] => {
    "msg": "Performing tasks for Development environment"
}
ok: [this-is-an-a-w-s-ome-bucket-name] => {
    "msg": "Performing tasks for Development environment"
}

TASK [Disable versioning for S3 buckets in the Dev environment] ***********************************************************************************************
ok: [testing-dme-demo-bucket]
changed: [this-is-an-a-w-s-ome-bucket-name]

TASK [Task for Production environment] ************************************************************************************************************************
skipping: [testing-dme-demo-bucket]
skipping: [this-is-an-a-w-s-ome-bucket-name]

PLAY RECAP ****************************************************************************************************************************************************
testing-dme-demo-bucket    : ok=3    changed=0    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0
this-is-an-a-w-s-ome-bucket-name : ok=3    changed=1    unreachable=0    failed=0    skipped=1    rescued=0    ignored=0
```
# Conclusion

The more I delve into the concepts of using Ansible alongside Terraform, the more convinced I become of their seamless integration and effectiveness when working in tandem. It's remarkably easy and straightforward to leverage Ansible for mass reconfigurations of my environments, all without the complexities associated with state files.

I am able to establish a default infrastructure using Terraform as a **provisioning** tool and then employ Ansible to fine-tune the **configuration**. This approach allows development teams to *empower* themselves with simple YAML-based Ansible files for (re)configuring their resources, eliminating the need to navigate through HCL or undergo lengthy processes involving approval from other teams via PR requests.

Moreover, the flexibility of Ansible roles enables precise trimming, aligning with the principles of lowering the [blast radius](https://en.wikipedia.org/wiki/Blast_radius) and embracing some concepts of [zero trust](https://en.wikipedia.org/wiki/Zero_trust_security_model).

**Enabling** your development teams should be a key concept in your organization, as it not only aligns with the DevOps philosophy but also expedites processes. Each team becomes capable of configuring its infrastructure independently, eliminating dependencies on other (infra) teams.
