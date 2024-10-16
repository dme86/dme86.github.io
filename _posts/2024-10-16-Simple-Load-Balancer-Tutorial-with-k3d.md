---
title: Simple Load Balancer Tutorial with k3d
layout: post
tags: [Tutorials]
---

In this brief tutorial, we’ll walk through how to deploy a simple load-balanced application using k3d, a lightweight Kubernetes distribution. This guide will help you set up port mappings and create a basic deployment in just a few minutes.

Currently, I’m working at an AI startup, where we’re building our core infrastructure around Kubernetes. For local development, I’ve chosen k3d due to its lightweight setup, ease of use, and speed, making it ideal for rapid experimentation and testing.

## Step 1: Reset k3d

Before we start, let’s ensure that there are no existing k3d clusters running. This will help us start with a clean slate.

To reset k3d and remove all clusters, run the following command:

```
k3d cluster delete -a
```

This command deletes all active k3d clusters so you can proceed without any conflicts.

## Step 2: Start the Cluster with Port Mappings

Now, let’s create a k3d cluster with one control plane and three worker nodes. We’ll map port **8080** on the *host* to port **80** *inside* the cluster. This allows us to expose our services externally:

```
k3d cluster create mycluster -s 1 -a 3 --port "8080:80@loadbalancer"
```
This command creates a cluster with load balancing enabled, mapping traffic from port 8080 on your local machine to port 80 within the cluster.

## Step 3: Deployment and Service

Next, we’ll deploy a simple Nginx service. First, create a deployment of three Nginx containers:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80

 ```
Then, define a service to expose the deployment within the cluster:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
  type: LoadBalancer
```
Apply these resources to the cluster:
```shell
kubectl apply -f nginx-deployment.yaml
kubectl apply -f nginx-service.yaml
```

## Step 4: Verifying the Deployment

Once the deployment is created, you can use `k9s` to monitor the status of your pods and services.

Navigate to `:deployments` to see the live logs from the `nginx-deployment`. You can also switch to `:pods` to observe the individual Nginx pods. If you terminate one of the pods, Kubernetes will automatically respawn it, ensuring no downtime, thanks to the ReplicaSet.

you can also curl the service from your local machine:
```shell
curl localhost:8080
```

