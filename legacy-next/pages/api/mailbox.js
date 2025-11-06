import { listMessages, countMessages, getDriverInfo } from '../../lib/db/adapter.js';

export default async function handler(req, res) {
  const { name, net, limit, offset } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'missing name' });
  }

  const ens = String(name || "").trim().toLowerCase();
  const network = (net || 'mainnet').toLowerCase();
  const messageLimit = parseInt(limit) || 50;
  const messageOffset = parseInt(offset) || 0;

  try {
    const messages = await listMessages({ 
      ens, 
      net: network, 
      limit: messageLimit, 
      offset: messageOffset 
    });
    
    const totalCount = await countMessages({ ens, net: network });
    const { driver } = getDriverInfo();
    
    console.log(`[mail] retrieved ${messages.length}/${totalCount} messages for ${ens} on ${network} | ${driver}`);

    // Transform to match old format for compatibility
    const transformedMessages = messages.map(msg => ({
      at: msg.created_at,
      to: msg.ens,
      from: msg.from_addr,
      subject: msg.subject,
      text: msg.body,
      net: msg.net,
      resolution: msg.meta?.resolution || null,
      id: msg.id
    }));

    return res.status(200).json({ 
      name: ens, 
      net: network, 
      messages: transformedMessages,
      total: totalCount,
      limit: messageLimit,
      offset: messageOffset
    });
  } catch (error) {
    console.error('[mail] database error:', error);
    return res.status(500).json({ error: 'failed to retrieve messages' });
  }
}
