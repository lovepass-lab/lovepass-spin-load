import { ethers } from "ethers";
import contentHash from "content-hash";

const GATEWAY = process.env.IPFS_GATEWAY || "https://ipfs.io";
const REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

const NETS = {
  mainnet:  { chainId: 1,        rpc: process.env.MAINNET_RPC_URL  || "https://ethereum.publicnode.com" },
  sepolia:  { chainId: 11155111, rpc: process.env.SEPOLIA_RPC_URL  || "https://ethereum-sepolia.publicnode.com" },
};

function toHttp(url) {
  if (!url) return null;
  if (url.startsWith("ipfs://")) return `${GATEWAY}/ipfs/${url.slice(7)}` ;
  if (url.startsWith("ipns://")) return `${GATEWAY}/ipns/${url.slice(7)}` ;
  return url;
}

// tiny timeout helper
function withTimeout(promise, ms, label = "operation") {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

  const name = String(req.query.name || "").trim().toLowerCase();
  const net  = String(req.query.net  || "mainnet").trim().toLowerCase();
  const verbose = String(req.query.verbose || "") === "1";

  if (!name) return res.status(400).json({ error: "name is required" });
  if (!name.endsWith(".eth")) return res.status(400).json({ error: "name must end with .eth" });
  if (!(net in NETS)) return res.status(400).json({ error: "unsupported network" });

  try {
    const { chainId, rpc } = NETS[net];
    const provider = new ethers.JsonRpcProvider(rpc, { name: net, chainId, ensAddress: REGISTRY });

    // Normal CCIP-aware resolver lookup
    let resolver = null;
    try {
      resolver = await provider.getResolver(name);
    } catch (e) {
      resolver = null;
    }

    // Manual fallback via ENS registry if resolver lookup failed
    if (!resolver) {
      try {
        const registry = new ethers.Contract(
          REGISTRY,
          ["function resolver(bytes32 node) view returns (address)"],
          provider
        );
        const node = ethers.namehash(name);
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
          // Safe resolver facade
          resolver = {
            address: addr,
            getContentHash: async () => {
              try {
                const raw = await manual.contenthash(node);
                if (!raw || raw === "0x") return null;
                try { return ethers.toUtf8String(raw); } catch (e) { return String(raw); }
              } catch (e) { return null; }
            },
            getText: async (key) => {
              try { return await manual.text(node, key); } catch (e) { return null; }
            }
          };
        }
      } catch (e) {
        // ignore; resolver remains null
      }
    }

    if (!resolver) return res.status(404).json({ error: "no resolver found" });

    const resolverAddress = resolver.address || null;

    // Try contenthash first
    let ch = null;
    try { ch = await resolver.getContentHash(); } catch (e) {}
    if (ch) {
      const url = toHttp(ch);
      const body = { name, network: net, contenthash: ch, url };
      if (verbose) Object.assign(body, { resolverAddress, source: "contenthash" });
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.status(200).json(body);
    }

    // Sepolia-only: direct on-chain debug path with RPC fallbacks
    if (net === "sepolia") {
      const rpcList = [
        process.env.SEPOLIA_RPC_URL,
        "https://ethereum-sepolia.publicnode.com",
        "https://1rpc.io/sepolia",
        "https://rpc2.sepolia.org",
        "https://rpc.sepolia.org",
      ].filter(Boolean);

      let lastDebug = null;
      for (const rpcUrl of rpcList) {
        try {
          const p = new ethers.JsonRpcProvider(rpcUrl, { name: net, chainId, ensAddress: REGISTRY });
          const node = ethers.namehash(name);
          const registry = new ethers.Contract(
            REGISTRY,
            ["function resolver(bytes32 node) view returns (address)"],
            p
          );
          const addr = await withTimeout(registry.resolver(node), 5000, `resolver() @ ${rpcUrl}`);
          if (!addr || addr === ethers.ZeroAddress) { lastDebug = { rpcUsed: rpcUrl, resolverAddress: null, rawLen: 0, rawPrefix: "0x" }; continue; }
          const manual = new ethers.Contract(
            addr,
            ["function contenthash(bytes32) view returns (bytes)"],
            p
          );
          const raw = await withTimeout(manual.contenthash(node), 6000, `contenthash() @ ${rpcUrl}`);
          const hex = typeof raw === "string" ? raw : (raw?.toString?.() || "0x");
          const len = (hex.startsWith("0x") ? (hex.length - 2) : hex.length) / 2;
          const prefix = hex.slice(0, 18);
          lastDebug = { rpcUsed: rpcUrl, resolverAddress: addr, rawLen: len, rawPrefix: prefix };

          if (hex && hex !== "0x") {
            let decoded = null;
            try {
              const codec = contentHash.getCodec(hex);
              const val = contentHash.decode(hex);
              if (codec === "ipfs-ns") decoded = `ipfs://${val}`;
              else if (codec === "ipns-ns") decoded = `ipns://${val}`;
              else decoded = null;
            } catch (e) {
              decoded = null;
            }

            if (decoded) {
              const url = toHttp(decoded);
              const body = { name, network: net, contenthash: decoded, url };
              if (verbose) Object.assign(body, { resolverAddress: addr, source: "direct", rpcUsed: rpcUrl, rawLen: len, rawPrefix: prefix });
              res.setHeader("Cache-Control", "public, max-age=60");
              return res.status(200).json(body);
            }
          }
        } catch (e) {
          // try next rpc
          lastDebug = Object.assign({ rpcUsed: rpcUrl }, lastDebug || {});
        }
      }

      // if we reach here, direct path failed or empty; include debug on verbose
      if (verbose && lastDebug) {
        return res.status(404).json({ error: "no contenthash found", ...lastDebug });
      }
    }

    // 2) Fallback: URL-like text records
    const textKeys = ["url", "website", "content", "ipfs", "ipns", "redirect", "homepage"];
    let textUrl = null;
    for (const key of textKeys) {
      let val = null;
      try { val = await resolver.getText(key); } catch (e) {}
      if (typeof val === "string" && val.length > 0) {
        if (val.startsWith("ipfs://") || val.startsWith("ipns://") || val.startsWith("https://")) {
          textUrl = val;
          break;
        }
      }
    }

    if (textUrl) {
      const url = toHttp(textUrl);
      const body = { name, network: net, contenthash: textUrl, url };
      if (verbose) Object.assign(body, { resolverAddress, source: "text" });
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.status(200).json(body);
    }

    // Nothing found
    const body = { error: "no contenthash found" };
    if (verbose) Object.assign(body, { resolverAddress, hasResolver: true, hasContenthash: false, triedTextKeys: textKeys });
    return res.status(404).json(body);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "failed to resolve" });
  }
}
