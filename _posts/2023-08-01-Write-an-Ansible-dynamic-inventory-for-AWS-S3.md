---
layout: post
title: Write an Ansible dynamic inventory for AWS S3
---

You may have already read my [former article](https://dme86.github.io/2023/06/23/Harnessing-the-Power-of-Terraform-and-Ansible-in-Perfect-Harmony/), which describes how to use Terraform **together** with Ansible. In this article, I will show you how you can enhance your setup further by writing your own (dynamic) inventory file for S3 buckets in Ansible.

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

You are now able to use tags to filter and perform tasks on specific S3 buckets based on their attributes.

Example playbook:
```yaml
---
- name: Example S3 bucket tasks
  hosts: all
  gather_facts: no


  tasks:
    - name: Show tags of the S3 bucket
      debug:
        var: hostvars[inventory_hostname].tags


    - name: Perform tasks based on the "Environment" tag
      debug:
        msg: "Performing tasks on S3 bucket {{ inventory_hostname }} with environment {{ hostvars[inventory_hostname].tags.Environment }}"


      # Add your tasks here, specific to different environments.
      # For example, you can use "when" conditionals to run tasks based on the "Environment" tag:
      # - name: Task for Development environment
      #   debug:
      #     msg: "Performing tasks for Development environment"
      #   when: hostvars[inventory_hostname].tags.Environment == "Development"


      # - name: Task for Production environment
      #   debug:
      #     msg: "Performing tasks for Production environment"
      #   when: hostvars[inventory_hostname].tags.Environment == "Production"
```

For simple testing you could call ansible like:

```shell
ansible-playbook -i aws_s3_inventory.py s3_bucket_tasks.yml
```

Output would look like this:

```shell
PLAY [Example S3 bucket tasks] ***************************************************************************************************************


TASK [Show tags of the S3 bucket] *************************************************************************************************************
ok: [example-bucket1] => {
    "hostvars[inventory_hostname].tags": {
        "foo": "bar",
        "owner": "ansible"
    }
}
ok: [example-bucket2] => {
    "hostvars[inventory_hostname].tags": {
        "foo": "bar",
        "owner": "ansible"
    }
}


TASK [Perform tasks based on tag] *******************************************************************************************
ok: [example-bucket1] => {
    "msg": "Performing tasks on S3 bucket example-bucket1 with environment bar"
}
ok: [example-bucket2] => {
    "msg": "Performing tasks on S3 bucket example-bucket2 with environment bar"
}


PLAY RECAP ************************************************************************************************************************************
example-bucket1       : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0
example-bucket2.      : ok=2    changed=0    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0*
```
