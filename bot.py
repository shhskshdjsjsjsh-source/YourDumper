import asyncio
import io
import os
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import aiohttp
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parent
PREFIX = os.getenv("PREFIX", ".")
TOKEN = os.getenv("DISCORD_TOKEN", "").strip()
LEAKD_BASE = os.getenv("LEAKD_API_BASE", "https://api.leakd.fr").rstrip("/")
SUPPORT_URL = "https://dsc.gg/nonedump"
ASPECT_FILE = ROOT / "aspect.luau"
MAX_BYTES = 8 * 1024 * 1024

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix=PREFIX, intents=intents, help_command=None, case_insensitive=True)


def support_view():
    view = discord.ui.View(timeout=None)
    view.add_item(discord.ui.Button(label="Support", style=discord.ButtonStyle.link, url=SUPPORT_URL))
    return view


def panel(title, description, color=0x111318, fields=None):
    embed = discord.Embed(title=title, description=description, color=color)
    embed.set_footer(text="YourDumper • created by nexusdeev")
    for name, value in fields or []:
        embed.add_field(name=name, value=value, inline=False)
    return embed


def preview(code, lines=5):
    text = "\n".join(str(code).splitlines()[:lines]).replace("```", "''' ")
    return f"```lua\n{text or '-- empty'}\n```"


async def read_source(ctx, args):
    attachment = ctx.message.attachments[0] if ctx.message.attachments else None
    if attachment:
        if attachment.size > MAX_BYTES:
            raise ValueError("The file exceeds the 8 MB limit.")
        data = await attachment.read()
        return data.decode("utf-8", errors="replace"), attachment.filename

    if ctx.message.reference:
        ref = ctx.message.reference.resolved or await ctx.channel.fetch_message(ctx.message.reference.message_id)
        if ref.attachments:
            a = ref.attachments[0]
            if a.size > MAX_BYTES:
                raise ValueError("The file exceeds the 8 MB limit.")
            return (await a.read()).decode("utf-8", errors="replace"), a.filename
        if ref.content:
            return ref.content, "reply.lua"

    raw = " ".join(args).strip()
    if raw.startswith("```") and raw.endswith("```"):
        raw = raw.split("\n", 1)[-1][:-3].strip()
    if raw.startswith(("http://", "https://")):
        async with aiohttp.ClientSession() as session:
            async with session.get(raw, timeout=aiohttp.ClientTimeout(total=30)) as response:
                if response.status >= 400:
                    raise ValueError(f"Download failed with HTTP {response.status}.")
                data = await response.read()
                if len(data) > MAX_BYTES:
                    raise ValueError("The file exceeds the 8 MB limit.")
                name = Path(urlparse(raw).path).name or "download.lua"
                return data.decode("utf-8", errors="replace"), name
    if not raw:
        raise ValueError("Send a file, URL, reply or Lua source code.")
    if len(raw.encode()) > MAX_BYTES:
        raise ValueError("The source exceeds the 8 MB limit.")
    return raw, "script.lua"


async def leakd(endpoint, code, filename):
    form = aiohttp.FormData()
    form.add_field("file", code.encode("utf-8"), filename=filename, content_type="text/plain")
    headers = {"User-Agent": "YourDumper/1.0"}
    if os.getenv("LEAKD_API_KEY"):
        headers["X-API-Key"] = os.getenv("LEAKD_API_KEY")
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{LEAKD_BASE}/{endpoint}", data=form, headers=headers, timeout=aiohttp.ClientTimeout(total=120)) as response:
            raw = await response.text()
            if response.status >= 400:
                raise RuntimeError(f"LeakD returned HTTP {response.status}.")
            try:
                data = await response.json(content_type=None)
            except Exception:
                return raw
    if isinstance(data, str):
        return data
    value = data.get("data", data) if isinstance(data, dict) else {}
    for key in ("deobfuscated_code", "beautified_code", "code", "result", "output", "content"):
        if isinstance(value, dict) and value.get(key):
            return value[key]
    return ""


async def run_aspect(code, filename):
    lune = os.getenv("LUNE_PATH", "lune")
    with tempfile.TemporaryDirectory(prefix="yourdumper-") as directory:
        folder = Path(directory)
        source = folder / filename
        output = folder / "result.lua"
        source.write_text(code, encoding="utf-8")
        process = await asyncio.create_subprocess_exec(lune, "run", str(ASPECT_FILE), str(source), str(output), cwd=ROOT, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=120)
        if process.returncode != 0:
            raise RuntimeError(stderr.decode(errors="replace").strip() or f"Aspect exited with code {process.returncode}.")
        if not output.exists():
            raise RuntimeError("Aspect did not produce an output file.")
        return output.read_text(encoding="utf-8", errors="replace")


class DeobfView(discord.ui.View):
    def __init__(self, code, filename):
        super().__init__(timeout=900)
        self.code = code
        self.filename = filename
        self.busy = False
        self.add_item(discord.ui.Button(label="Support", style=discord.ButtonStyle.link, url=SUPPORT_URL))

    async def run(self, interaction, endpoint, label):
        if self.busy:
            return await interaction.response.send_message("This job is already running. Please wait for the first result.", ephemeral=True, view=support_view())
        self.busy = True
        await interaction.response.defer()
        try:
            output = await leakd(endpoint, self.code, self.filename)
            if not output.strip():
                raise RuntimeError("LeakD returned no output.")
            out_name = f"{Path(self.filename).stem}_{endpoint}_clean.lua"
            embed = panel("YourDumper • Deobfuscation complete", "The cleaned file is attached and hosted by the selected engine.", 0x3CC86E, [("Engine", label), ("Preview", preview(output))])
            await interaction.edit_original_response(embed=embed, view=support_view())
            await interaction.followup.send(content=f"Generated file: `{out_name}`", file=discord.File(io.BytesIO(output.encode()), filename=out_name), view=support_view())
        except Exception as error:
            await interaction.edit_original_response(embed=panel("YourDumper • Error", str(error), 0xED4245), view=support_view())
        finally:
            self.busy = False

    @discord.ui.button(label="MoonSec", style=discord.ButtonStyle.primary)
    async def moonsec(self, interaction, button):
        await self.run(interaction, "moonsec", "MoonSec • LeakD")

    @discord.ui.button(label="Prometheus", style=discord.ButtonStyle.primary)
    async def prometheus(self, interaction, button):
        await self.run(interaction, "prometheus", "Prometheus • LeakD")


@bot.event
async def on_ready():
    print(f"YourDumper is online as {bot.user} | prefix: {PREFIX}")


@bot.command(name="ping")
async def ping(ctx):
    await ctx.send(embed=panel("YourDumper • Pong", f"Latency: **{round(bot.latency * 1000)}ms**"), view=support_view())


@bot.command(name="help")
async def help_command(ctx):
    text = "\n".join([
        f"`{PREFIX}help` — Show this command list",
        f"`{PREFIX}ping` — Check bot latency",
        f"`{PREFIX}l` — Run the Aspect dumper",
        f"`{PREFIX}get` — Download and attach a script",
        f"`{PREFIX}deobf` — Choose MoonSec or Prometheus",
    ])
    await ctx.send(embed=panel("YourDumper • Commands", "English-only script tools.\n\n" + text, fields=[("Creator", "nexusdeev"), ("Support", SUPPORT_URL)]), view=support_view())


@bot.command(name="get")
async def get_command(ctx, *args):
    try:
        code, filename = await read_source(ctx, args)
        await ctx.send(embed=panel("YourDumper • Download complete", "The requested script is attached.", 0x3CC86E, [("File", filename), ("Preview", preview(code))]), file=discord.File(io.BytesIO(code.encode()), filename=filename), view=support_view())
    except Exception as error:
        await ctx.send(embed=panel("YourDumper • Error", str(error), 0xED4245), view=support_view())


@bot.command(name="l")
async def aspect_command(ctx, *args):
    try:
        code, filename = await read_source(ctx, args)
        async with ctx.typing():
            output = await run_aspect(code, filename)
        out_name = f"{Path(filename).stem}_aspect.lua"
        await ctx.send(embed=panel("YourDumper • Aspect", "The Aspect output is attached.", 0x3CC86E, [("Preview", preview(output))]), file=discord.File(io.BytesIO(output.encode()), filename=out_name), view=support_view())
    except Exception as error:
        await ctx.send(embed=panel("YourDumper • Error", str(error), 0xED4245), view=support_view())


@bot.command(name="deobf")
async def deobf_command(ctx, *args):
    try:
        code, filename = await read_source(ctx, args)
        await ctx.send(embed=panel("YourDumper • Deobfuscator", "Choose an engine below. The selected button becomes locked while processing.", fields=[("File", filename), ("Preview", preview(code))]), view=DeobfView(code, filename))
    except Exception as error:
        await ctx.send(embed=panel("YourDumper • Error", str(error), 0xED4245), view=support_view())


if __name__ == "__main__":
    if not TOKEN or TOKEN == "put_your_bot_token_here":
        raise SystemExit("Set DISCORD_TOKEN in .env before starting YourDumper.")
    bot.run(TOKEN)
