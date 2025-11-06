// pages/mailbox/[name].jsx
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts || "";
  }
}

export default function MailboxPage({ initialName, initialNet, initialData }) {
  const [name, setName] = useState(initialName || "");
  const [net, setNet] = useState(initialNet || "mainnet");
  const [data, setData] = useState(initialData || { name, net, messages: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/mailbox?name=${encodeURIComponent(name)}&net=${encodeURIComponent(net)}` );
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Auto-refresh every 10s while viewing
    const id = setInterval(() => refresh(), 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, net]);

  useEffect(() => {
    // Ensure we show the latest right away on mount
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Head>
        <title>Lovepass Mail — {name} ({net})</title>
      </Head>
      <main style={{ maxWidth: 880, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
        <header style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, margin: 0 }}>Lovepass Mail</h1>
          <span style={{ color: "#555" }}>Inbox</span>
        </header>

        <section style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <label>
            ENS:
            <input
              value={name}
              onChange={(e) => setName(e.target.value.trim())}
              placeholder="vaped.eth"
              style={{ marginLeft: 8, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8 }}
            />
          </label>
          <label>
            Net:
            <select value={net} onChange={(e) => setNet(e.target.value)} style={{ marginLeft: 8, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8 }}>
              <option value="mainnet">mainnet</option>
              <option value="sepolia">sepolia</option>
            </select>
          </label>
          <button
            onClick={refresh}
            style={{
              padding: "8px 14px",
              border: "1px solid #222",
              background: "#111",
              color: "white",
              borderRadius: 10,
              cursor: "pointer"
            }}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <Link href={`/api/mailbox?name=${encodeURIComponent(name)}&net=${encodeURIComponent(net)}` } legacyBehavior>
            <a style={{ marginLeft: "auto", color: "#06c", textDecoration: "none" }}>View JSON</a>
          </Link>
        </section>

        {error && (
          <div style={{ background: "#fee", border: "1px solid #f99", padding: 12, borderRadius: 8, marginBottom: 16, color: "#900" }}>
            {error}
          </div>
        )}

        {/* DEV-ONLY: Compose a test message */}
        {process.env.NODE_ENV !== "production" && (
          <section style={{ marginBottom: 16, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Compose test</div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const subject = form.subject.value;
                const text = form.text.value;

                // map "vaped.eth" -> "vaped@lovepass.eth"
                const local = (name || "").replace(/\.eth$/i, "");
                const to = `${local}@lovepass.eth`;

                try {
                  const res = await fetch("/api/email", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "X-Auth-Token": process.env.NEXT_PUBLIC_DEV_AUTH || ""
                    },
                    body: JSON.stringify({
                      to,
                      from: "demo@lovepass.dev",
                      subject,
                      text,
                      net
                    })
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json?.error || "Failed to send");
                  await refresh(); // pull latest
                  form.reset();
                  alert("Sent!");
                } catch (err) {
                  alert(String(err));
                }
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  name="subject"
                  placeholder="Subject"
                  required
                  style={{ flex: "1 1 240px", padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8 }}
                />
                <button
                  type="submit"
                  style={{ padding: "8px 14px", border: "1px solid #222", background: "#111", color: "white", borderRadius: 10, cursor: "pointer" }}
                >
                  Send
                </button>
              </div>
              <textarea
                name="text"
                placeholder="Message…"
                rows={3}
                style={{ marginTop: 8, width: "100%", padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
                To: <b>{(name || "").replace(/\.eth$/i, "")}@lovepass.eth</b> on <b>{net}</b>
              </div>
            </form>
          </section>
        )}

        <div style={{ background: "#f7f7f8", border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{data?.name || name}</div>
              <div style={{ color: "#555", fontSize: 12 }}>Network: {data?.net || net}</div>
            </div>
            <div style={{ color: "#555", fontSize: 12 }}>{(data?.messages?.length || 0)} messages</div>
          </div>

          {(data?.messages?.length || 0) === 0 ? (
            <div style={{ color: "#555", padding: "24px 8px" }}>No messages yet.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {data.messages
                .slice()
                .reverse()
                .map((m, idx) => (
                  <li key={idx} style={{ borderTop: "1px solid #eee", padding: "12px 8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.subject || "(no subject)"}
                      </div>
                      <div style={{ color: "#555", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(m.at)}</div>
                    </div>
                    <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>
                      From: <b>{m.from}</b> → To: <b>{m.to}</b>
                    </div>
                    {m.text && (
                      <p style={{ marginTop: 8, marginBottom: 0, whiteSpace: "pre-wrap" }}>
                        {m.text}
                      </p>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <footer style={{ color: "#555", fontSize: 12, marginTop: 16 }}>
          Tip: open <code>/mailbox/vaped.eth?net=sepolia</code> in your browser and keep it pinned while testing.
        </footer>
      </main>
    </>
  );
}

// Server-side param hydration so URL sets initial state
export async function getServerSideProps(ctx) {
  const { name = "", net = "mainnet" } = ctx.query || {};
  let initialData = null;

  try {
    // Use NEXT_PUBLIC_APP_URL for production, fallback to host header for dev
    const base = process.env.NEXT_PUBLIC_APP_URL || `http://${ctx.req.headers.host}`;
    const res = await fetch(`${base}/api/mailbox?name=${encodeURIComponent(name)}&net=${encodeURIComponent(net)}`);
    initialData = await res.json();
  } catch (error) {
    console.error('[mailbox] SSR fetch error:', error.message);
    initialData = { name, net, messages: [] };
  }

  return {
    props: {
      initialName: name,
      initialNet: net,
      initialData,
    },
  };
}
