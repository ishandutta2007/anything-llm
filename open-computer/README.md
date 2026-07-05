<a name="readme-top"></a>

<p align="center">
  <a href="https://github.com/Mintplex-Labs/anything-llm/tree/master/open-computer"><img src="https://github.com/Mintplex-Labs/anything-llm/blob/master/open-computer/assets/OPEN_COMPUTER.png?raw=true" alt="Open Computer logo"></a>
</p>

<p align="center">
    <b>Open Computer:</b>An fully featured computer for AI Agents.<br />
    Isolated, secure, and purposed built computers for AI Agents you can run fully on your hardware.
</p>

> [!IMPORTANT]
> This project is a work in progress and is something we do intend to bring to AnythingLLM in the future for custom, secure, and scalable agent use.
>
> ⭐ Star the repo to stay updated!

Open Computer is an OS that is being built expressly for AI agents to manipulate to get a task done. The OS is meant for **humans** to manage, but for agents to use. Open Computer is not a general purpose OS, it is a specialized OS for AI agents and is **purposefully** built for use with on-device LLMs.

One of the core principles of Open Computer is that it is designed to be a human in loop OS. This means that the human should be able to easily manage the agents and the computer and the agent should be able to easily communicate with the human via it's UI that allows the user to **see and act** on the computer in real time. This is collaborbation with an agent moreso than just a tool.

The primary intent is a UX paradigm for agents that eveolve our of a terminal/TUI "black box" into a more observable and collaborative experience that a non-technical user can easily understand and work in alongside the agent.

AI Agents are also heavy CLI users and are the most "comfortable" with Bash so putting them in a fixed Linux environment is the best way to get them to do their best work. The downside is that many people are not comfortable with Linux and do not want to learn it to be able to use an agent. This is where Open Computer comes in and gives a best of both worlds approach to AI Agent use.

## Purpose

Agents and agent harnesses are only as useful as the permissions they are given. The more permissions they have, the more they can do, however giving agents so much access is a huge security risk, but also widly impractical for non-cli tasks like computer use tasks.

Open Computer is a QEMU-based virtual desktop environment for AI agents. To this point, the OS is modified and packed with services and tooling to make the computer usable for AI agents, but also trival to use for humans with a standard UI so that it is easy to setup per-agent for non-technical users.

## Open Computer Objectives

0. **Human in loop first**: Open Computer is designed to be a human in loop OS. This means that the human should be able to easily manage the agents and the computer. Additionally, the agent should be able to easily communicate with the human via `ask-user` that allows the user to **see and act** on the computer in real time. This is collaborbation with an agent moreso than just a tool.
1. Create an OS that can be easily spun up and down for each agent that is meaningfully isolated from the host OS and other agents while being very small in both space, compute, and memory usage on the host.
2. The OS comes pre-packaged with services and tooling to make the computer usable for AI agents - like a browser, a text editor, a terminal, a file manager, etc.
3. Users should be able to easily setup machines for agents by just using a computer like they would any other computer.
4. **No reliance on screenshots**: Computer use as it stands today is reliant on screenshots and coordinate guessing to be able to navigate the computer. This method is not scalable, practical, or cost effective. Everything in Open Computer is designed to be able to be used without even needing a vision model.
5. Optimized browser use: The browser is the primary tool for AI agents to use to get tasks done. It is therefore important to optimize the browser for use with AI agents. To this end, we have modified the browser tool to be more token efficient and more capable of handling complex tasks than popular tools like browser-use (60% less tokens per task)
6. Native app manipulation: Open Computer is designed to be able to manipulate native apps as if they were a web app. This is done via similar techniques to `cua`. Since we only need to rely on a single base OS (Linux Debian) we can just use A11y techniques directly - which work well.
7. Passwordless `sudo`: Open Computer agents should and need to be able to do **anything** they want. This means it can install packages and do whatever it needs to do to get the job done. This can be turned off if desired, but is on by default.
8. Do all of this without requiring a ton of compute, memory, or space on the host machine.

> Currently, each agents base overlay is only about 100MB in size, the base image is about 2.9GB, and the OS ISO is around 700MB.
> Since this is basically a standalone OS - that is pretty nice!

## How it works

Open Computer is built to where the LLM inference can be anywhere (like on the host machine or a cloud provider), this is done via a single port forwarding mechanism that allows the agent to connect to the LLM and send and receive messages, but that is all. The OS itself is completely agnostic to the LLM provider and is designed to be able to work with any LLM provider.

Any provider that supports the [OpenAI API](https://platform.openai.com/docs/api-reference) can be used to power Open Computer. You **do not** need a vision model to use Open Computer, however it would probably help.

### Inside Open Computer

The Open Computer OS is currently built on top of a base image of [Debian 13.5.0 (Trixie)](https://www.debian.org/releases/trixie/).

1. Agent Harness: The agent harness is the core of Open Computer and is the minimal and lightweight client [Pi](https://pi.dev) running via RPC mode. This harness has also specific extensions we have created to make it more capable of handling complex tasks with small context windows. You can always add your own extensions to the harness to make it more capable of handling your specific tasks.

2. Interface Service: The [interface service](./services/server/index.js) is the service that allows the agent to interact with the computer. It is an HTTP/WebSocket server that allows the agent to send and receive messages to the computer. It is also the service that allows the agent to interact with the browser and native apps. This also serves the full UI when `open-computer create/up agent --dev` is used.

3. Memory Manager: The [memory manager](./services/memory-manager/index.js) is the service that allows the agent to manage its memory. This is the [pi-heremes-memory](https://pi.dev/packages/pi-hermes-memory) package, but with a full UI and management interface to easily manage the memory of the agent.

4. XFCE Desktop: The desktop environment is XFCE. This is the desktop environment that is used to power the agent's UI. It is a lightweight desktop environment that is easy to use and customize and is ["riced"](https://jie-fang.github.io/blog/basics-of-ricing) to look like Windows 10. This was forked from [Fake10](https://store.kde.org/p/2332691) and modified to look like Windows 10.

5. Chromium Browser: The browser is Chromium - seems pretty straightforward.

This lightweight architecture allows for the OS to be very modular and easy to extend and modify. This also means that each agent is trival in both space, compute, and memory usage.

### QEMU and Debian

Open Computer achieves virtualization using a lightweight built of QEMU. From there we use an iso of Debian 13.5.0 to install and create the very base image of debian - which is saved in the `master/base_image` folder as `base.qcow2`.

From there, we build up the base image to its starting point with the `open-computer provision` command. This command will install all of the necessary services and tooling to make the computer usable for AI agents as well as the custom services it relies on for communicatation with LLMs running on the host.

### How agents work

All agents inherit the `base_image` created from a basic Debian OS onboarding, but have their own `.qcow2` that contains the delta of their **specific** installation. This means you can have mulitple agents all running at the same time, each with their own customized tools, purpose, and configurations.

### Can you use local models?

Yes, Open Computer is **designed** with small LLMs running on device in mind. As a base assumption we assume you have at **least** a 16K tokens context window. The built in agent harness is designed to be able to handle this context window and is optimized for it doing regular compression, pruning, and other techniques to make the most of the context window while still being able to handle complex tasks.

In fact, because the inference can be anywhere, you can use tools like LM Studio, Ollama, OMLX, or really anything that supports the OpenAI API to power your agent's computer.

---

# Quick Start

To get started with Open Computer, you can shortcut having to build QEMU or the base image by using the pre-built QEMU binaries and the `base_image` we have provided.

## Unzip the QEMU binaries

In the `master/qemu` folder there are pre-built QEMU binaries for macOS ARM64 and Windows x64. You can just unzip the one you need and use it. For MacOS, you might have to unquarantine the binaries first. If you dont want to do that, you can build QEMU from source [here](master/qemu/BUILD-QEMU.md).

## Grab the base Debian ISO

For this, you can download the correct arch ISO (x64 or arm64) from the [Debian OSUOSL](https://debian.osuosl.org/debian-cdimage/13.5.0/) and save it to the `master/iso` folder.

Or you can use the script we have provided to fetch the ISO from the OSUOSL - `scripts/fetch-debian-iso.{sh,ps1}`.

## Making the base image

Making the base image is pretty tedious since you have to install a VNC viewer and go through the process of installing the OS as a VM. This can be done manually by following the instructions in the [DEVELOPMENT.md](./DEVELOPMENT.md) file.

Since the base_image is in such a flux state right now, we do not have a pre-built base image at this time - so you will have to build it from scratch.

## Starting an agent

To start an agent, you can use the `open-computer create/up agent --dev` command. This will start the agent in a development mode where you can see the agent's UI and interact with it in real time. You can then hook it up to an LLM provider and have it start working on tasks (local or cloud).

---

# Future Plans

Open Computer is a work in progress and depending on feedback and usage, we will be making changes to the OS and it's architecture to make it more capable and useful for the community.

Right now, this project is more in the proof of concept stage, and the future intention is to truly build out a modified OS as opposed to this current approach, but for a first pass, this works well and is a great way to get started with the concept of AI Agent computers.

## Roadmap

- [ ] Supports for Windows ARM64: Currently only macOS ARM64 and Windows x64 are supported.
- [ ] Add cross-agent communication: Allow agents to communicate with each other via a shared communication channel.
- [ ] Firewalls, NAT, and other network services via a simple config or even UI component
- [ ] Custom Harnesses: Allow users to bring in their existing agent harnesses and use them with Open Computer (like OpenClaw or Hermes)
- [ ] Agent cloning: Fork an agent and its current state and use it as a starting point for a new agent.
- [ ] Improvements to the base image build process: Automate the process of building the base image from scratch.
- [ ] Enterprise-ready features: Firewall, NAT, VPN, audit logs, etc.

## 🔗 More Products

- **[AnythingLLM][https://github.com/Mintplex-Labs/anything-llm]:** The all-in-one AI app you were looking for.
- **[AnythingLLM Mobile (MIT Licensed)][https://github.com/Mintplex-Labs/anythingllm-mobile]:** A mobile application that allows you to use AnythingLLM on your mobile device.

<div align="right">

[![][back-to-top]](#readme-top)

</div>

---

Copyright © 2026 [Mintplex Labs][https://github.com/Mintplex-Labs/anything-llm]. <br />
This project is [AGPL-3.0](./LICENSE) licensed.