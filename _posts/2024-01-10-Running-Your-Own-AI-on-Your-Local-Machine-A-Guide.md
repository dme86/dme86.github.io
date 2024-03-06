---
title: Running Your Own AI on Your Local Machine - A Guide
layout: post
tags: [AI]
---

In another article, I talked about utilizing [GPT's API to write a Telegram Chat-Bot](https://dme86.github.io/2024/01/10/Write-your-own-GPT-based-Telegram-Assistent/). Now, I will write about using an [LLM](https://en.wikipedia.org/wiki/LLaMA) *like* GPT but on your local machine and for free.
You can also use it via a modern ChatGPT-styled Web-UI and give your coworkers access to it.

<!-- more -->

I tested this on my Mac, so I could install ollama via `brew install ollama`, but they have [downloads](https://ollama.ai/download) available for Linux and Windows too.

To start ollama, just type `ollama serve` and wait a bit:

![enter image description here](https://i.imgur.com/Divxl3s.png)

It should start listening on `localhost` port `11434`.
![enter image description here](https://i.imgur.com/iTjPH7p.png)

Now you are able to run a model, e.g., llama2 via `ollama run llama2` in another shell:

![enter image description here](https://i.imgur.com/er0gTiQ.png)

As evident, it is readily usable. Alternatively, you can employ `curl`, for instance:

![enter image description here](https://i.imgur.com/gRbSas9.png)

## Ollama Web UI

This WebUI is a community-driven project and is not affiliated with the Ollama team in any way.

The easiest and fastest way to set up and test the Web UI is via Docker:


    docker run -d -p 3000:8080 --add-host=host.docker.internal:host-gateway \
                      -v ollama-webui:/app/backend/data --name ollama-webui --restart always \
                      ghcr.io/ollama-webui/ollama-webui:main

You should be able to access it via [http://localhost:3000](http://localhost:3000/) , and the first user who registers will be granted administrator rights.

![enter image description here](https://i.imgur.com/iT4R7k7.png)

After login, you're able to choose your model and chat with it in a ChatGPT-style interface:

![enter image description here](https://i.imgur.com/iHCOocw.png)
![enter image description here](https://i.imgur.com/HiJlGSL.png)
![enter image description here](https://i.imgur.com/QkxhRyK.png)
![enter image description here](https://i.imgur.com/UlZA0VL.png)

## Conclusion

I love everything about it - the simplicity, the accessibility, and the strong community behind those projects. "AI," or better [LLM](https://en.wikipedia.org/wiki/LLaMA), will play a more significant role in the future of how we work, learn, and interact with computers. I am thrilled that it is now so easy to run something like this on a local machine in a few minutes.

Please make sure to use [TLS](https://en.wikipedia.org/wiki/Transport_Layer_Security) if you want to host this for your friends or coworkers.
