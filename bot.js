"use strict";

require("dotenv").config();
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const ROOT = __dirname;
const PREFIX = process.env.PREFIX || ".";
const TOKEN = (process.env.DISCORD_TOKEN || "").trim();
const SUPPORT_URL = "https://dsc.gg/nonedump";
const MAX_BYTES = 8 * 1024 * 1024;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

function supportRow() {
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel("Support").setStyle(ButtonStyle.Link).setURL(SUPPORT_URL));
}

function preview(value, lines = 5) {
  let text = String(value || "").split(/\r?\n/).slice(0, lines).join("\n").replaceAll("```", "''' ");
  text = text.slice(0, 1200);
  if (text.length === 1200) text += "\n...";
  return `\`\`\`lua\n${text || "-- empty"}\n\`\`\``;
}

function embed(title, description, color = 0x111318, fields = []) {
  const e = new EmbedBuilder().setTitle(String(title).slice(0, 256)).setDescription(String(description).slice(0, 3500)).setColor(color).setFooter({ text: "YourDumper • created by nexusdeev" });
  for (const [name, value] of fields) e.addFields({ name: String(name).slice(0, 256), value: `${String(value).slice(0, 1200)}${String(value).length > 1200 ? "\n..." : ""}`, inline: false });
  return e;
}

async function fetchSource(message, args) {
  let attachment = message.attachments.first();
  if (!attachment && message.reference) {
    const referenced = await message.fetchReference().catch(() => null);
    attachment = referenced?.attachments?.first();
    if (attachment) message = referenced;
    else if (referenced?.content) return { code: referenced.content, filename: "reply.lua" };
  }
  if (attachment) {
    if (attachment.size > MAX_BYTES) throw new Error("The file exceeds the 8 MB limit.");
    const response = await fetch(attachment.url);
    if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}.`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > MAX_BYTES) throw new Error("The file exceeds the 8 MB limit.");
    return { code: data.toString("utf8"), filename: attachment.name || "script.lua" };
  }
  let raw = args.join(" ").trim();
  if (raw.startsWith("```") && raw.endsWith("```")) raw = raw.split("\n").slice(1).join("\n").slice(0, -3).trim();
  if (/^https?:\/\//i.test(raw)) {
    const response = await fetch(raw);
    if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}.`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > MAX_BYTES) throw new Error("The file exceeds the 8 MB limit.");
    return { code: data.toString("utf8"), filename: path.basename(new URL(raw).pathname) || "download.lua" };
  }
  if (!raw) throw new Error("Send a file, URL, reply or Lua source code.");
  if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error("The source exceeds the 8 MB limit.");
  return { code: raw, filename: "script.lua" };
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd || ROOT, windowsHide: true });
    const stdout = []; const stderr = [];
    child.stdout?.on("data", data => stdout.push(data));
    child.stderr?.on("data", data => stderr.push(data));
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("The engine timed out after 180 seconds.")); }, options.timeout || 180000);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); resolve({ code, stdout: Buffer.concat(stdout).toString(), stderr: Buffer.concat(stderr).toString() }); });
  });
}

async function runEngine(engine, code, filename) {
  const folder = await fsp.mkdtemp(path.join(os.tmpdir(), "yourdumper-"));
  const input = path.join(folder, path.basename(filename));
  const output = path.join(folder, "result.lua");
  await fsp.writeFile(input, code, "utf8");
  try {
    const project = path.join(ROOT, engine === "moonsec" ? "moonsec-deobf" : "prometheus-deobf");
    const script = path.join(project, "bin", engine === "moonsec" ? "ms.js" : "pdeobf.js");
    const result = await runProcess(process.execPath, [script, input, "-o", output, ...(engine === "prometheus" ? ["-q"] : [])], { cwd: project });
    if (result.code !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `${engine} exited with code ${result.code}.`);
    return await fsp.readFile(output, "utf8");
  } finally { await fsp.rm(folder, { recursive: true, force: true }); }
}

function findLune() {
  const configured = (process.env.LUNE_PATH || "").trim();
  const candidates = [configured, path.join(ROOT, "runtime", process.platform === "win32" ? "lune.exe" : "lune"), path.join(ROOT, process.platform === "win32" ? "lune.exe" : "lune")].filter(Boolean);
  const found = candidates.map(p => path.isAbsolute(p) ? p : path.resolve(ROOT, p)).find(p => fs.existsSync(p));
  if (!found) throw new Error("Lune is not installed. Set LUNE_PATH to the full path of the Lune executable.");
  if (process.platform !== "win32") { try { fs.chmodSync(found, 0o755); } catch {} }
  return found;
}

async function runAspect(code, filename) {
  const folder = await fsp.mkdtemp(path.join(os.tmpdir(), "yourdumper-aspect-"));
  const input = path.join(folder, path.basename(filename)); const output = path.join(folder, "result.lua");
  await fsp.writeFile(input, code, "utf8");
  try {
    const result = await runProcess(findLune(), ["run", path.join(ROOT, "aspect.luau"), input, output], { cwd: ROOT, timeout: 120000 });
    if (result.code !== 0) throw new Error(result.stderr.trim() || "Aspect exited with an error.");
    return await fsp.readFile(output, "utf8");
  } finally { await fsp.rm(folder, { recursive: true, force: true }); }
}

async function sendError(message, error) { await message.reply({ embeds: [embed("YourDumper • Error", error.message || String(error), 0xed4245)], components: [supportRow()] }); }
async function runDeobf(message, args, engine, label) {
  try {
    const { code, filename } = await fetchSource(message, args);
    await message.channel.sendTyping();
    const output = await runEngine(engine, code, filename);
    const outName = `${path.parse(filename).name}_${engine}_clean.lua`;
    await message.reply({ embeds: [embed("YourDumper • Deobfuscation complete", "The cleaned file is attached and was generated locally.", 0x3cc86e, [["Engine", label], ["Preview", preview(output)]])], files: [{ attachment: Buffer.from(output), name: outName }], components: [supportRow()] });
  } catch (error) { await sendError(message, error); }
}

client.once("ready", () => console.log(`YourDumper is online as ${client.user.tag} | prefix: ${PREFIX}`));
client.on("messageCreate", async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  const [name, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  if (!name) return;
  try {
    switch (name.toLowerCase()) {
      case "ping": return message.reply({ embeds: [embed("YourDumper • Pong", `Latency: **${client.ws.ping}ms**`)], components: [supportRow()] });
      case "help": return message.reply({ embeds: [embed("YourDumper • Commands", "Script tools for authorized analysis.\n\n" + [`${PREFIX}help — Show this command list`, `${PREFIX}ping — Check bot latency`, `${PREFIX}l — Run the Aspect dumper`, `${PREFIX}get — Download and attach a script`, `${PREFIX}wearedevs — Prometheus with the WeAreDevs profile`, `${PREFIX}promdeobf — Local Prometheus engine`, `${PREFIX}moonsec — Local MoonSec engine`].map(x => `\`${x}\``).join("\n"), 0x111318, [["Creator", "nexusdeev"], ["Support", SUPPORT_URL]])], components: [supportRow()] });
      case "get": { const { code, filename } = await fetchSource(message, args); return message.reply({ embeds: [embed("YourDumper • Download complete", "The requested script is attached.", 0x3cc86e, [["File", filename], ["Preview", preview(code)]])], files: [{ attachment: Buffer.from(code), name: filename }], components: [supportRow()] }); }
      case "l": { const { code, filename } = await fetchSource(message, args); await message.channel.sendTyping(); const output = await runAspect(code, filename); return message.reply({ embeds: [embed("YourDumper • Aspect", "The Aspect output is attached.", 0x3cc86e, [["Preview", preview(output)]])], files: [{ attachment: Buffer.from(output), name: `${path.parse(filename).name}_aspect.lua` }], components: [supportRow()] }); }
      case "wearedevs": return runDeobf(message, args, "prometheus", "Prometheus • WeAreDevs");
      case "promdeobf": return runDeobf(message, args, "prometheus", "Prometheus • Local engine");
      case "moonsec": return runDeobf(message, args, "moonsec", "MoonSec • Local engine");
      default: return;
    }
  } catch (error) { await sendError(message, error); }
});

if (!TOKEN || TOKEN === "put_your_bot_token_here") throw new Error("Set DISCORD_TOKEN in .env before starting YourDumper.");
client.login(TOKEN);
