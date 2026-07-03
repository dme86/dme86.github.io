---
title: Simple Load Balancer Tutorial with k3d
layout: post
tags: [Tutorials]
---

Local Kubernetes clusters are useful when an application needs more than a single container. They provide a realistic environment for testing Deployments, Services, routing, health checks, and failure recovery without requiring a remote cluster.

[k3d](https://k3d.io/) runs K3s nodes as containers. In this tutorial, we will disable the ingress controller bundled with K3s and use [Envoy Gateway](https://gateway.envoyproxy.io/) to manage Envoy as the application-facing data plane. Instead of maintaining a large static `envoy.yaml`, we will describe the desired routing with the Kubernetes Gateway API.

<!-- more -->

## Why Envoy Gateway?

Envoy Proxy is highly configurable, but its native configuration format reflects that power. Even a small listener, route, cluster, health check, and access-log setup can require a substantial amount of YAML. That is appropriate when we need low-level control, but it is unnecessary boilerplate for a Kubernetes routing example.

Envoy Gateway provides a Kubernetes-native control plane for Envoy. We declare a `GatewayClass`, a `Gateway`, and an `HTTPRoute`; Envoy Gateway validates these resources and translates them into the detailed configuration consumed by Envoy. The generated Envoy configuration still exists, but it is owned and continuously reconciled by the controller rather than copied into a ConfigMap by hand.

The request path in this tutorial is:

```text
localhost:8080
    │
    ▼
k3d port mapping
    │
    ▼
K3s ServiceLB
    │
    ▼
Envoy managed by Envoy Gateway
    │
    ▼
Kubernetes Service
    │
    ├── backend pod
    ├── backend pod
    └── backend pod
```

There are several components involved, but their responsibilities are distinct:

- k3d exposes port 80 from the local cluster as port 8080 on the host.
- K3s ServiceLB makes Envoy Gateway's `LoadBalancer` Service reachable on the cluster nodes.
- Envoy terminates the HTTP connection, evaluates the route, and forwards the request.
- The Kubernetes Service and its EndpointSlices represent the healthy backend pods.

This is more representative of a modern Kubernetes setup than embedding a complete static Envoy configuration in an application manifest.

## Prerequisites

The tutorial requires:

- Docker
- [k3d](https://k3d.io/stable/#installation)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Helm](https://helm.sh/docs/intro/install/)
- `curl`

Confirm that the tools are available:

```shell
docker version
k3d version
kubectl version --client
helm version
```

The commands below pin Envoy Gateway to `v1.8.2` so that the example remains reproducible. Before using a different version, check the [Envoy Gateway compatibility matrix](https://gateway.envoyproxy.io/news/releases/matrix/) for the supported Kubernetes, Gateway API, and Envoy versions.

## 1. Create a Cluster Without Traefik

Create a cluster named `envoy-gateway-demo` with one K3s server and three agents:

```shell
k3d cluster create envoy-gateway-demo \
  --servers 1 \
  --agents 3 \
  --k3s-arg="--disable=traefik@server:0" \
  --port "8080:80@loadbalancer" \
  --wait
```

The `--disable=traefik` argument prevents K3s from installing its bundled Traefik ingress controller. We do not need two ingress implementations competing for the same purpose, and leaving port 80 free allows K3s ServiceLB to expose Envoy cleanly.

The port mapping publishes port 80 of k3d's load-balancer container as `localhost:8080`. This is the normal k3d entry point for a Service exposed inside the cluster.

k3d updates the kubeconfig and selects the new context. Verify the cluster:

```shell
kubectl cluster-info
kubectl get nodes
kubectl get deployment --namespace kube-system
```

The node list should contain one server and three agents, all reporting `Ready`. The deployment list should not contain Traefik.

If a cluster with the same name already exists, delete that cluster specifically before recreating it:

```shell
k3d cluster delete envoy-gateway-demo
```

Avoid deleting every local cluster as part of a tutorial setup. Other clusters may contain unrelated work.

## 2. Install Envoy Gateway

Install Envoy Gateway from its official OCI Helm chart:

```shell
helm install eg \
  oci://docker.io/envoyproxy/gateway-helm \
  --version v1.8.2 \
  --namespace envoy-gateway-system \
  --create-namespace
```

Wait until the controller is available:

```shell
kubectl wait \
  --namespace envoy-gateway-system \
  --for=condition=Available \
  deployment/envoy-gateway \
  --timeout=5m
```

The chart installs the Envoy Gateway controller together with the required Envoy Gateway and Gateway API custom resource definitions. On a shared or production cluster, CRD ownership and upgrades should be handled deliberately rather than treated as an incidental part of an application deployment.

At this point, only the control plane is running. Envoy Gateway creates an Envoy data plane after we define a `Gateway`.

## 3. Define the Application and Route

Create a file named `envoy-gateway-demo.yaml`:

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
  type: ClusterIP
  selector:
    app: backend
  ports:
    - name: http
      port: 8080
      targetPort: http
---
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: envoy-gateway-demo
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: demo
  namespace: envoy-demo
spec:
  gatewayClassName: envoy-gateway-demo
  listeners:
    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: backend
  namespace: envoy-demo
spec:
  parentRefs:
    - name: demo
      sectionName: http
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: backend
          port: 8080
```

Apply the resources:

```shell
kubectl apply --filename envoy-gateway-demo.yaml
```

Wait for the backend Deployment:

```shell
kubectl wait \
  --namespace envoy-demo \
  --for=condition=Available \
  deployment/backend \
  --timeout=2m
```

Then inspect the Gateway API status:

```shell
kubectl get gatewayclass envoy-gateway-demo
kubectl get gateway,httproute --namespace envoy-demo
```

The `GatewayClass` should report `Accepted`, and the `Gateway` should eventually report that it has been programmed. Envoy Gateway creates and configures the corresponding Envoy Deployment and `LoadBalancer` Service in `envoy-gateway-system`.

You can see those generated resources with:

```shell
kubectl get deployment,service \
  --namespace envoy-gateway-system \
  --selector gateway.envoyproxy.io/owning-gateway-name=demo
```

The generated names are intentionally not hard-coded in the tutorial. They are implementation details owned by Envoy Gateway.

## 4. Understand the Gateway API Resources

The manifest separates concerns that would otherwise be mixed into one static proxy configuration:

- `GatewayClass` selects Envoy Gateway as the controller responsible for this class of gateways.
- `Gateway` requests an HTTP listener on port 80. It represents the infrastructure entry point.
- `HTTPRoute` attaches to that listener and forwards matching requests to the backend Service.
- `Service` provides a stable Kubernetes abstraction over the ready backend pods.

The `allowedRoutes` setting restricts this listener to routes from the same namespace. That is a useful default because it prevents unrelated namespaces from attaching routes without an explicit decision.

No hostname is specified in this example, so the route accepts any HTTP `Host` header. Production routes should usually declare hostnames and use TLS listeners with certificates appropriate for those names.

The important difference from a hand-written Envoy deployment is ownership. We own the Kubernetes intent. Envoy Gateway owns the generated listeners, clusters, endpoint discovery, and data-plane lifecycle. If pods or endpoints change, the controller updates Envoy without requiring us to rebuild a static ConfigMap.

## 5. Send Requests Through Envoy

Call the backend through the host port:

```shell
curl http://localhost:8080/hostname
```

The response contains the name of the backend pod that handled the request. Send several independent requests:

```shell
for request in $(seq 1 12); do
  curl --silent http://localhost:8080/hostname
  printf '\n'
done
```

The output should contain multiple pod names, demonstrating that requests reach more than one replica. Do not expect an exact repeating sequence: connection reuse, endpoint readiness, retries, and load-balancing policy can all influence the observed order.

Confirm that three backend pods are available:

```shell
kubectl get pods \
  --namespace envoy-demo \
  --selector app=backend \
  --output=wide
```

The topology spread constraint asks Kubernetes to distribute the replicas across nodes where possible. It is not required for HTTP load balancing, but it makes the local topology more representative of a multi-node deployment.

## 6. Inspect Routing and Troubleshoot Failures

Gateway API status conditions are the first place to look when traffic does not flow:

```shell
kubectl describe gateway demo --namespace envoy-demo
kubectl describe httproute backend --namespace envoy-demo
```

Useful conditions include:

- `Accepted`, which indicates that the relevant controller accepts the resource.
- `Programmed`, which indicates that the requested data-plane configuration was applied.
- `ResolvedRefs`, which indicates that referenced objects such as the backend Service could be resolved.

Next, verify the backend Service and its endpoints:

```shell
kubectl get service,endpointslice --namespace envoy-demo
```

If the route is valid but requests still fail, inspect the Envoy Gateway controller:

```shell
kubectl logs \
  --namespace envoy-gateway-system \
  deployment/envoy-gateway
```

Also verify that the generated Envoy Service has an external address or published ports:

```shell
kubectl get service \
  --namespace envoy-gateway-system \
  --selector gateway.envoyproxy.io/owning-gateway-name=demo \
  --output=wide
```

On k3d, the displayed address is less important than the complete path through the k3d port mapping and K3s ServiceLB. `curl http://localhost:8080/hostname` is the final end-to-end check.

## 7. Observe Failure Recovery

Delete one backend pod and watch the Deployment restore the desired replica count:

```shell
BACKEND_POD=$(kubectl get pods \
  --namespace envoy-demo \
  --selector app=backend \
  --output=jsonpath='{.items[0].metadata.name}')

kubectl delete pod "$BACKEND_POD" --namespace envoy-demo

kubectl get pods \
  --namespace envoy-demo \
  --selector app=backend \
  --watch
```

Press `Ctrl-C` after the replacement pod becomes ready, then repeat the request loop. Kubernetes updates the Service's EndpointSlices as pod readiness changes, and Envoy Gateway propagates the relevant endpoint state to Envoy.

This is the value of using Kubernetes-native discovery rather than a static list of pod IP addresses: the routing configuration follows the declared application state.

## What This Example Does Not Cover

This setup is intentionally local and minimal. A production design also needs decisions about:

- TLS termination and certificate lifecycle
- authentication and authorization
- timeouts, retries, circuit breakers, and rate limits
- access logs, metrics, traces, and alerting
- high availability and disruption budgets
- network policies and namespace delegation
- resource sizing and upgrade strategy
- the infrastructure-specific implementation of `LoadBalancer` Services

Envoy Gateway supports policies and extensions for many of these concerns, but enabling features without a clear operational requirement usually makes a tutorial less useful. Start with a working request path, then add policy deliberately.

## Clean Up

Delete the cluster when it is no longer needed:

```shell
k3d cluster delete envoy-gateway-demo
```

Because Envoy Gateway and the application live inside that cluster, deleting the cluster removes all resources created by the tutorial.

## Conclusion

The earlier static Envoy configuration was not unusually long because Envoy was doing something mysterious. It was long because native Envoy configuration explicitly describes details that a Kubernetes control plane can derive and manage.

Envoy Gateway moves that responsibility to a controller and lets us express the routing model with standard Gateway API resources. The result is shorter application-owned configuration, clearer responsibility boundaries, Kubernetes-native status reporting, and a data plane that is reconciled as the cluster changes.

For a standalone proxy, a hand-written `envoy.yaml` may still be the right tool. For Kubernetes ingress and application routing, Envoy Gateway is usually the more maintainable abstraction.
