import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div>
          <p className="eyebrow">VaultWager · Zama FHE</p>
          <h1>Encrypted dice that only you can reveal.</h1>
          <p className="subtitle">
            Swap ETH for private points and play the classic Big/Small dice game on Sepolia.
            Each result stays encrypted until you request the decryption through Zama&apos;s relayer.
          </p>
        </div>
        <ConnectButton label="Connect wallet" />
      </div>
    </header>
  );
}
