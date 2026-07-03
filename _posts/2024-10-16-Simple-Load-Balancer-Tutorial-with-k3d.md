---
title: Simple Load Balancer Tutorial with k3d
layout: post
tags: [Tutorials]
---

Local Kubernetes environments are useful when an application needs more than a single container. They provide a realistic place to test Deployments, Services, service discovery, health checks, and failure recovery without paying for a remote cluster.

[k3d](https://k3d.io/) runs K3s nodes as containers and creates a lightweight Kubernetes cluster on a local machine. In this tutorial, we will explicitly disable the ingress controller bundled with K3s and use [Envoy Proxy](https://www.envoyproxy.io/) as the only application-facing load balancer. Envoy will discover three backend pods through Kubernetes DNS and distribute requests across them using round-robin load balancing.

<!-- more -->

## What We Are Building

The request path is deliberately small:

```text
localhost:8080
    │
    ▼
k3d port mapping
    │
    ▼
Kubernetes NodePort Service
    │
    ▼
Envoy Proxy
    │
    ▼
Headless Kubernetes Service
    │
    ├── backend pod
    ├── backend pod
    └── backend pod
```

The NodePort Service makes Envoy reachable from the host. It does not distribute traffic to the application pods. Envoy performs that task.

The backend uses a headless Service, which returns pod IP addresses through cluster DNS instead of presenting one virtual Service IP. Envoy's strict DNS discovery treats every returned address as an upstream host and can therefore balance directly across the pods.

This distinction matters. If Envoy were configured with a normal ClusterIP Service as its only upstream address, Kubernetes would perform the final backend selection. Traffic would still work, but the tutorial would not demonstrate Envoy's own load-balancing behavior.

## Prerequisites

The tutorial requires:

- Docker
- [k3d](https://k3d.io/stable/#installation)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- `curl`

Confirm that the commands are available:

```shell
docker version
k3d version
kubectl version --client
```

## 1. Create a Cluster Without Traefik

Create a cluster named `envoy-load-balancer` with one K3s server and three agents:

```shell
k3d cluster create envoy-load-balancer \
  --servers 1 \
  --agents 3 \
  --k3s-arg="--disable=traefik@server:0" \
  --port "8080:30080@agent:0" \
  --wait
```

The `--disable=traefik` argument prevents K3s from installing its bundled Traefik ingress controller. The node filter `@server:0` applies that K3s argument to the initializing server.

The port expression maps port `8080` on the local machine to port `30080` on the first k3d agent. Later, a NodePort Service will listen on that port and forward traffic to Envoy.

k3d updates the default kubeconfig and selects the new context. Verify the cluster before deploying anything:

```shell
kubectl cluster-info
kubectl get nodes
```

The node list should contain one server and three agents. All nodes should eventually report `Ready`.

It is also worth verifying the assumption that Traefik is absent:

```shell
kubectl get deployment --namespace kube-system
```

The output should not contain a Traefik Deployment.

If a cluster with the same name already exists, delete that cluster specifically before recreating it:

```shell
k3d cluster delete envoy-load-balancer
```

Avoid deleting every local cluster as part of a tutorial setup. Other clusters may contain unrelated work.

## 2. Define the Backends and Envoy

Create a file named `envoy-load-balancer.yaml` with the following resources:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: envoy-demo
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: envoy-demo
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: backend
      containers:
        - name: backend
          image: registry.k8s.io/e2e-test-images/agnhost:2.53
          command:
            - /agnhost
          args:
            - netexec
            - --http-port=8080
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            tcpSocket:
              port: http
            initialDelaySeconds: 1
            periodSeconds: 3
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              memory: 64Mi
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: envoy-demo
spec:
  clusterIP: None
  selector:
    app: backend
  ports:
    - name: http
      port: 8080
      targetPort: http
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: envoy-config
  namespace: envoy-demo
data:
  envoy.yaml: |
    static_resources:
      listeners:
        - name: http_listener
          address:
            socket_address:
              address: 0.0.0.0
              port_value: 10000
          filter_chains:
            - filters:
                - name: envoy.filters.network.http_connection_manager
                  typed_config:
                    "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                    stat_prefix: ingress_http
                    access_log:
                      - name: envoy.access_loggers.stdout
                        typed_config:
                          "@type": type.googleapis.com/envoy.extensions.access_loggers.stream.v3.StdoutAccessLog
                    route_config:
                      name: local_route
                      virtual_hosts:
                        - name: backend
                          domains:
                            - "*"
                          routes:
                            - match:
                                prefix: "/"
                              route:
                                cluster: backend_pods
                    http_filters:
                      - name: envoy.filters.http.router
                        typed_config:
                          "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
      clusters:
        - name: backend_pods
          type: STRICT_DNS
          connect_timeout: 1s
          dns_lookup_family: V4_ONLY
          dns_refresh_rate: 2s
          lb_policy: ROUND_ROBIN
          load_assignment:
            cluster_name: backend_pods
            endpoints:
              - lb_endpoints:
                  - endpoint:
                      address:
                        socket_address:
                          address: backend.envoy-demo.svc.cluster.local
                          port_value: 8080

    admin:
      access_log_path: /tmp/envoy-admin.log
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 9901
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: envoy
  namespace: envoy-demo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: envoy
  template:
    metadata:
      labels:
        app: envoy
    spec:
      containers:
        - name: envoy
          image: envoyproxy/envoy:v1.38-latest
          args:
            - -c
            - /etc/envoy/envoy.yaml
            - --service-cluster
            - local-demo
            - --log-level
            - info
          ports:
            - name: http
              containerPort: 10000
            - name: admin
              containerPort: 9901
          readinessProbe:
            httpGet:
              path: /ready
              port: admin
            initialDelaySeconds: 2
            periodSeconds: 3
          resources:
            requests:
              cpu: 20m
              memory: 32Mi
            limits:
              memory: 128Mi
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
            runAsNonRoot: true
            runAsUser: 101
            runAsGroup: 101
          volumeMounts:
            - name: envoy-config
              mountPath: /etc/envoy/envoy.yaml
              subPath: envoy.yaml
              readOnly: true
      securityContext:
        seccompProfile:
          type: RuntimeDefault
      volumes:
        - name: envoy-config
          configMap:
            name: envoy-config
---
apiVersion: v1
kind: Service
metadata:
  name: envoy
  namespace: envoy-demo
spec:
  type: NodePort
  selector:
    app: envoy
  ports:
    - name: http
      port: 10000
      targetPort: http
      nodePort: 30080
```

The backend image is Kubernetes' small test server. Its `/hostname` endpoint returns the name of the pod handling the request, which makes backend selection observable without introducing another proxy.

The backend Service is deliberately headless because `clusterIP: None` causes cluster DNS to return the ready pod addresses. Envoy uses `STRICT_DNS` service discovery, refreshes the result regularly, and treats every returned address as a distinct upstream host. `ROUND_ROBIN` then selects among those hosts.

The Envoy admin interface is used only by the readiness probe and is not exposed through the Service. An externally reachable Envoy admin interface would provide powerful operational controls and should not be published casually.

The Envoy image tracks the latest patch of the maintained `1.38` release line. Pin an exact image version or digest in a production repository and update it through the normal dependency and vulnerability-management process.

## 3. Apply and Verify the Resources

Apply the complete manifest:

```shell
kubectl apply -f envoy-load-balancer.yaml
```

Wait for both Deployments:

```shell
kubectl wait \
  --namespace envoy-demo \
  --for=condition=Available \
  deployment/backend \
  --timeout=120s

kubectl wait \
  --namespace envoy-demo \
  --for=condition=Available \
  deployment/envoy \
  --timeout=120s
```

Inspect the resources:

```shell
kubectl get deployment,pods,service \
  --namespace envoy-demo \
  --output=wide
```

There should be three ready backend pods, one ready Envoy pod, one headless backend Service, and one NodePort Service for Envoy.

If a Deployment does not become available, start with:

```shell
kubectl describe deployment backend --namespace envoy-demo
kubectl describe deployment envoy --namespace envoy-demo
kubectl get events --namespace envoy-demo --sort-by=.lastTimestamp
```

For Envoy configuration or upstream-discovery problems, inspect its logs:

```shell
kubectl logs deployment/envoy --namespace envoy-demo
```

## 4. Observe Envoy Load Balancing

Send one request from the local machine:

```shell
curl http://localhost:8080/hostname
```

The response should resemble:

```text
backend-6f8d7b9c5f-abc12
```

Send several independent requests:

```shell
for request in $(seq 1 12); do
  curl --silent http://localhost:8080/hostname
  printf '\n'
done
```

The three pod names should recur in a roughly round-robin sequence. The exact output can vary while endpoints are added, removed, or rediscovered, so a short sequence should be treated as an observation rather than a statistical guarantee.

Envoy writes one access-log entry for every request. Follow those logs in another terminal:

```shell
kubectl logs \
  --namespace envoy-demo \
  deployment/envoy \
  --follow
```

Inspect the addresses published by the headless Service:

```shell
kubectl get endpointslice \
  --namespace envoy-demo \
  --selector kubernetes.io/service-name=backend \
  --output=wide
```

Those endpoint addresses are the backend set Envoy obtains through DNS.

## 5. Observe Endpoint Changes

List the current backend pods:

```shell
kubectl get pods \
  --namespace envoy-demo \
  --selector app=backend
```

Delete one pod by replacing `<pod-name>` with a name from the output:

```shell
kubectl delete pod <pod-name> --namespace envoy-demo
```

Watch the Deployment return to three ready replicas:

```shell
kubectl get pods \
  --namespace envoy-demo \
  --selector app=backend \
  --watch
```

The Deployment's ReplicaSet creates a replacement. Once the new pod passes its readiness probe, the headless Service publishes its address. Envoy discovers the DNS change and begins including the new endpoint in load balancing.

This demonstrates reconciliation and endpoint discovery, not a universal guarantee of zero downtime. Availability still depends on sufficient healthy replicas, accurate probes, capacity, graceful termination, and application behavior.

## Why Not Use a Kubernetes LoadBalancer Service?

For this local setup, a fixed NodePort provides the simplest explicit connection between the host and Envoy. The Envoy Service has exactly one job: deliver incoming traffic to the Envoy pod.

A `LoadBalancer` Service in K3s would involve the embedded ServiceLB implementation. That is useful in other scenarios, but it would add another load-balancing mechanism to an example intended to show Envoy's upstream discovery and selection.

Likewise, no Ingress resource is required. An Ingress resource needs an ingress controller to implement it, and this tutorial deliberately disables the bundled controller. Envoy is configured directly as the data plane.

For a larger Kubernetes platform, static Envoy configuration is usually not the final architecture. [Envoy Gateway](https://gateway.envoyproxy.io/) can manage Envoy through the Kubernetes Gateway API and is a better fit when teams need declarative routes, listeners, policies, and multi-tenant lifecycle management. Direct configuration remains useful here because it exposes the listener, cluster, discovery type, and load-balancing policy without hiding them behind a control plane.

## Clean Up

Delete the complete local cluster when finished:

```shell
k3d cluster delete envoy-load-balancer
```

Because the Kubernetes nodes run as containers, deleting the cluster also removes the workloads and cluster state created for this tutorial.

## Conclusion

The useful result in this example is not merely that `curl localhost:8080/hostname` returns a pod name. It is a clear understanding of which component owns each decision.

k3d provides the local Kubernetes environment and host-port mapping. The NodePort Service exposes Envoy. Kubernetes DNS publishes ready backend pod addresses through the headless Service. Envoy discovers those addresses and applies the configured round-robin policy.

That model is small enough to inspect directly and close enough to real service-proxy behavior to be useful. Production requirements—TLS, authentication, authorization, retries, timeouts, circuit breaking, observability, configuration delivery, and highly available Envoy replicas—can then be added deliberately instead of being hidden inside an ambiguous "load balancer" label.
