export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Lovepass ENS CCIP Gateway</h1>
      <p style={{ color: '#555' }}>Next.js is active. Try the mailbox page:</p>
      <ul>
        <li><a href="/mailbox/vaped.eth?net=sepolia" style={{ color: '#06c', textDecoration: 'none' }}>Mailbox: vaped.eth (sepolia)</a></li>
      </ul>
      <p style={{ color: '#555' }}>APIs:</p>
      <ul>
        <li><a href="/api/ccip?name=vitalik.eth" style={{ color: '#06c', textDecoration: 'none' }}>/api/ccip?name=vitalik.eth</a></li>
        <li><a href="/api/mailbox?name=vaped.eth&net=sepolia" style={{ color: '#06c', textDecoration: 'none' }}>/api/mailbox?name=vaped.eth&net=sepolia</a></li>
      </ul>
    </main>
  );
}
