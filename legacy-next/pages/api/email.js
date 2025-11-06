import { ethers } from "ethers";
import { insertMessage, countMessages, getDriverInfo } from "../../lib/db/adapter.js";

const GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io";
const REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

const NETS = {
  mainnet:  { chainId: 1,        rpc: process.env.MAINNET_RPC_URL  || "https://ethereum.publicnode.com" },
  sepolia:  { chainId: 11155111, rpc: process.env.SEPOLIA_RPC_URL  || "https://ethereum-sepolia.publicnode.com" },
};

function toHttp(url) {
  if (!url) return null;
  if (url.startsWith("ipfs://")) return `${GATEWAY}/ipfs/${url.slice(7)}`;
  if (url.startsWith("ipns://")) return `${GATEWAY}/ipns/${url.slice(7)}`;
  return url;
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return {}; }
}

async function resolveEnsBasics(name, net) {
  const { chainId, rpc } = NETS[net];
  const provider = new ethers.JsonRpcProvider(rpc, { name: net, chainId, ensAddress: REGISTRY });

  // Try CCIP-aware path first
  let resolver = null;
  try { resolver = await provider.getResolver(name); } catch { resolver = null; }

  // Fallback: registry -> resolver
  if (!resolver) {
    try {
      const node = ethers.namehash(name);
      const registry = new ethers.Contract(
        REGISTRY,
        ["function resolver(bytes32 node) view returns (address)"],
        provider
      );
      const addr = await registry.resolver(node);
      if (addr && addr !== ethers.ZeroAddress) {
        const manual = new ethers.Contract(
          addr,
          [
            "function contenthash(bytes32) view returns (bytes)",
            "function text(bytes32,string) view returns (string)"
          ],
          provider
        );
        resolver = {
          address: addr,
          getContentHash: async () => {
            try {
              const raw = await manual.contenthash(node);
              if (!raw || raw === "0x") return null;
              try { return ethers.toUtf8String(raw); } catch { return String(raw); }
            } catch { return null; }
          },
          getText: async (key) => { try { return await manual.text(node, key); } catch { return null; } }
        };
      }
    } catch { /* ignore */ }
  }

  if (!resolver) return { resolverAddress: null, contenthash: null, url: null };

  let ch = null;
  try { ch = await resolver.getContentHash(); } catch { ch = null; }
  const url = toHttp(ch);
  return { resolverAddress: resolver.address || null, contenthash: ch, url };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Auth-Token");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  // auth (tolerate incidental whitespace, unicode dashes/quotes, zero-width chars)
  const normalize = (s) => {
    let v = String(s || "");
    // Normalize unicode dashes to ASCII '-'
    v = v.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-');
    // Normalize typographic quotes to ASCII then handle stripping
    v = v.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
    // Remove zero-width/invisible chars
    v = v.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
    // Remove non-breaking and exotic spaces
    v = v.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
    v = v.trim();
    // Strip surrounding quotes only if both ends match
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    // Collapse internal multiple spaces (shouldn't be in secrets, but be forgiving)
    v = v.replace(/\s+/g, ' ');
    return v;
  };

  const headerToken = req.headers["x-auth-token"] || req.headers["X-Auth-Token"] || "";
  const bearer = (req.headers["authorization"] || "").toString();
  const bearerToken = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7) : "";
  const provided = normalize(headerToken || bearerToken || "");
  const serverSecret = normalize(process.env.INBOUND_SECRET);
  if (!serverSecret) return res.status(500).json({ error: "server misconfigured: INBOUND_SECRET missing" });
  if (provided !== serverSecret) return res.status(401).json({ error: "unauthorized" });

  const body = await parseJsonBody(req);
  let { to = "", from = "", subject = "", text = "", net = "mainnet" } = body || {};

  if (typeof to !== "string") to = String(to || "");
  if (typeof from !== "string") from = String(from || "");
  if (typeof subject !== "string") subject = String(subject || "");
  if (typeof text !== "string") text = String(text || "");
  if (typeof net !== "string") net = String(net || "mainnet");
  net = net.trim().toLowerCase();

  // Key mailbox by local-part ENS (e.g., vaped@lovepass.eth -> vaped.eth)
  let ens = String(to || "").trim().toLowerCase();
  const originalTo = to; // Keep original for to_addr field
  if (ens.includes("@")) {
    const local = ens.split("@")[0];
    ens = local.trim().toLowerCase() + ".eth";
  }
  if (!ens.endsWith(".eth")) return res.status(400).json({ error: "to must be an ENS .eth address or user@lovepass.eth" });
  if (!(net in NETS)) return res.status(400).json({ error: "unsupported network" });

  // Resolve using ENS
  const resolution = await resolveEnsBasics(ens, net);

  // Build message
  const msg = {
    at: new Date().toISOString(),
    to: ens,
    from,
    subject,
    text,
    net,
    resolution
  };

  // Store in database
  try {
    const messageId = await insertMessage({
      ens,
      net,
      from_addr: from,
      to_addr: originalTo,
      subject,
      body: text,
      meta: { resolution }
    });
    
    const totalCount = await countMessages({ ens, net });
    const { driver, host } = getDriverInfo();
    console.log(`[mail] stored message ${messageId} for ${ens} on ${net} | ${driver} | Total: ${totalCount}`);
    
    return res.status(200).json({ 
      ok: true, 
      stored: true, 
      messageId,
      inboxUrl: `/api/mailbox?name=${encodeURIComponent(ens)}&net=${encodeURIComponent(net)}`,
      resolution 
    });
  } catch (error) {
    console.error("[mail] database error:", error);
    return res.status(500).json({ error: "failed to store message" });
  }
}
