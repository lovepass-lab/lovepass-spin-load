import { http, createConfig } from 'wagmi';
import { base, baseSepolia, mainnet, sepolia } from 'wagmi/chains';
import { getDefaultWallets } from '@rainbow-me/rainbowkit';

const projectId = 'lovepass-dev'; // replace in Settings if needed

const { wallets } = getDefaultWallets({ appName: 'Lovepass Mail', projectId, chains: [baseSepolia, base, mainnet, sepolia] });

export const config = createConfig({
  chains: [baseSepolia, base, mainnet, sepolia],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  multiInjectedProviderDiscovery: true,
});
