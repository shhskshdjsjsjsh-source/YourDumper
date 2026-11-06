# YourDumper

**YourDumper** is a lightweight Discord script toolkit built with Python and `discord.py` Components v1.

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![discord.py](https://img.shields.io/badge/discord.py-2.x-5865F2?logo=discord&logoColor=white)
![Status](https://img.shields.io/badge/status-ready-3CC86E)
![License](https://img.shields.io/badge/license-respect%20component%20licenses-111318)

Created by **nexusdeev**.

[Support Server](https://dsc.gg/nonedump)

> A compact dumper and deobfuscation interface for authorized script analysis.

## Contents

- [Features](#features)
- [Commands](#commands)
- [Installation](#installation)
- [Aspect runtime](#aspect-runtime)
- [Hosting](#hosting)
- [Project layout](#project-layout)
- [Credits](#credits)

## Features

- Clean prefix commands with `.` as the default prefix.
- Discord embeds, buttons and file attachments.
- Aspect dumper using `aspect.luau`.
- Script download support from attachments, replies, URLs and inline code.
- MoonSec and Prometheus commands through the bundled local engines.
- Consistent command interface.
- A Support button on every response.
- Each deobfuscation command runs one local engine per request.

## Commands

| Command | Description |
| --- | --- |
| `.help` | Shows the command catalog and project information. |
| `.ping` | Displays the Discord gateway latency. |
| `.l` | Runs the Aspect dumper from `aspect.luau`. |
| `.get` | Downloads a script from an attachment, reply, URL or inline source and attaches it. |
| `.wearedevs` | Runs the local Prometheus engine with the WeAreDevs profile. |
| `.promdeobf` | Runs the local Prometheus engine. |
| `.moonsec` | Runs the local MoonSec engine. |

Every response includes a **Support** button linking to [dsc.gg/nonedump](https://dsc.gg/nonedump).

## Input examples

```text
.ping
.help
.get https://example.com/script.lua
.moonsec https://example.com/obfuscated.lua
```

You can also attach a Lua file or reply to a message containing a file/code and run the command without arguments.

## Installation

### 1. Create the environment

```bash
python -m venv .venv
```

Windows:

```powershell
.\.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

Install the local JavaScript engine dependencies once:

```bash
cd moonsec-deobf && npm install
cd ../prometheus-deobf && npm install
cd ..
```

### 3. Configure `.env`

Copy `.env.example` to `.env`, set the Discord token, and point `LUNE_PATH` at the Lune executable installed on the host:

```env
DISCORD_TOKEN=your_discord_bot_token
PREFIX=.
LUNE_PATH=/app/runtime/lune
```

Never commit `.env` or expose the bot token.

### 4. Start

```bash
python bot.py
```

The bot requires the Discord **Message Content Intent**. Enable it in the Discord Developer Portal and invite the bot with the permissions needed to read messages, send messages, embed links and attach files.

## Aspect runtime

`.l` runs `aspect.luau` through the included `runtime/lune` executable. Set `LUNE_PATH` to another absolute executable path when your host uses a different runtime (for example `/app/runtime/lune` or `C:\\tools\\lune.exe`). If it is omitted, YourDumper checks its bundled runtime, common local runtime folders and the system `PATH`.

## Hosting

YourDumper is a normal Python worker and can run on a VPS or a bot host:

```bash
pip install -r requirements.txt
python bot.py
```

For process managers, use:

```text
worker: python bot.py
```

## Project layout

```text
YourDumper/
├── bot.py
├── aspect.luau
├── runtime/lune
├── moonsec-deobf/
├── prometheus-deobf/
├── requirements.txt
├── Procfile
├── .env.example
└── README.md
```

## Credits

YourDumper was created by **nexusdeev**. The Discord interface, command routing and integration layer are maintained as a separate Python project from None Tools v3.

## License

Respect the licenses and terms of the bundled Aspect, MoonSec and Prometheus components. The deobfuscators run locally; no script is sent to a third-party deobfuscation API. Use the bot only with scripts you are authorized to analyze.
