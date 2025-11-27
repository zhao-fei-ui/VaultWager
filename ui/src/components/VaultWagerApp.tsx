import { useMemo, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Contract } from 'ethers';
import { parseEther } from 'viem';
import { CONTRACT_ADDRESS, CONTRACT_ABI, POINTS_PER_ETH, ROUND_REWARD } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/VaultWagerApp.css';

const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

type SecureData = {
  balancePoints?: number;
  diceOne?: number;
  diceTwo?: number;
  total?: number;
  guessedBig?: boolean;
  wasCorrect?: boolean;
  errorCode?: number;
  timestamp?: number;
};

const ERROR_MESSAGES: Record<number, string> = {
  0: 'No errors detected',
  1: 'Insufficient points to cover a loss',
};

type LastRoundResponse = {
  diceOne: `0x${string}`;
  diceTwo: `0x${string}`;
  total: `0x${string}`;
  guessedBig: `0x${string}`;
  wasCorrect: `0x${string}`;
};

type LastErrorResponse = {
  code: `0x${string}`;
  timestamp: bigint;
};

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return '—';
  return new Date(timestamp * 1000).toLocaleString();
};

const parseDecryptedValue = (value: unknown): bigint | undefined => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string' && value !== '') {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const parseDecryptedBool = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  const parsed = parseDecryptedValue(value);
  if (parsed === undefined) return undefined;
  return parsed === 1n;
};

export function VaultWagerApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [ethAmount, setEthAmount] = useState('0.1');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isGuessing, setIsGuessing] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [secureData, setSecureData] = useState<SecureData | null>(null);

  const balanceQuery = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedBalance',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const roundQuery = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getLastRound',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const lastErrorQuery = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getLastError',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const conversionPreview = useMemo(() => {
    const value = Number(ethAmount);
    if (Number.isNaN(value) || value < 0) {
      return 0;
    }
    return Math.round(value * POINTS_PER_ETH);
  }, [ethAmount]);

  const updateStatus = (message: string | null) => {
    setStatusMessage(message);
    if (message) {
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  const handleDeposit = async () => {
    if (!isConnected) {
      updateStatus('Connect your wallet to purchase points.');
      return;
    }
    if (!ethAmount || Number(ethAmount) <= 0) {
      updateStatus('Enter a valid ETH amount.');
      return;
    }

    setIsDepositing(true);
    try {
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer is not available.');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.purchasePoints({ value: parseEther(ethAmount) });
      updateStatus('Deposit submitted. Waiting for confirmation...');
      await tx.wait();
      updateStatus('Points purchased successfully!');
      setSecureData(null);
      balanceQuery.refetch();
    } catch (error) {
      console.error('Deposit failed', error);
      updateStatus(error instanceof Error ? error.message : 'Failed to purchase points.');
    } finally {
      setIsDepositing(false);
    }
  };

  const handleGuess = async (guess: 'big' | 'small') => {
    if (!isConnected) {
      updateStatus('Connect your wallet to play.');
      return;
    }

    setIsGuessing(true);
    try {
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Signer is not available.');
      }
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.playRound(guess === 'big');
      updateStatus(`Guess submitted (${guess === 'big' ? 'Big' : 'Small'}). Waiting for settlement...`);
      await tx.wait();
      updateStatus('Round finished! Decrypt to reveal the dice and outcome.');
      setSecureData(null);
      roundQuery.refetch();
      balanceQuery.refetch();
      lastErrorQuery.refetch();
    } catch (error) {
      console.error('Round failed', error);
      updateStatus(error instanceof Error ? error.message : 'Failed to play a round.');
    } finally {
      setIsGuessing(false);
    }
  };

  const handleDecrypt = async () => {
    if (!instance || !address) {
      updateStatus('Encryption service or wallet missing.');
      return;
    }

    const signer = await signerPromise;
    if (!signer) {
      updateStatus('Signer is not available.');
      return;
    }

    const balanceHandle = balanceQuery.data as `0x${string}` | undefined;
    const roundData = roundQuery.data as unknown as LastRoundResponse | undefined;
    const latestErrorCipher = lastErrorQuery.data as unknown as LastErrorResponse | undefined;

    const handles: { handle: `0x${string}`; contractAddress: string }[] = [];
    if (balanceHandle && balanceHandle !== ZERO_HANDLE) {
      handles.push({ handle: balanceHandle, contractAddress: CONTRACT_ADDRESS });
    }
    if (roundData) {
      const possible = [roundData.diceOne, roundData.diceTwo, roundData.total, roundData.guessedBig, roundData.wasCorrect] as
        | `0x${string}`[]
        | undefined;
      possible?.forEach((handle) => {
        if (handle && handle !== ZERO_HANDLE) {
          handles.push({ handle, contractAddress: CONTRACT_ADDRESS });
        }
      });
    }
    if (latestErrorCipher && latestErrorCipher.code !== ZERO_HANDLE) {
      handles.push({ handle: latestErrorCipher.code, contractAddress: CONTRACT_ADDRESS });
    }

    if (handles.length === 0) {
      updateStatus('Nothing to decrypt yet. Play a round or purchase points first.');
      return;
    }

    setDecrypting(true);
    try {
      const keypair = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handles,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimestamp,
        durationDays,
      );

      const decrypted: SecureData = {};
      if (balanceHandle && result[balanceHandle]) {
        const value = parseDecryptedValue(result[balanceHandle]);
        if (value !== undefined) {
          decrypted.balancePoints = Number(value);
        }
      }
      if (roundData) {
        const diceOne = roundData.diceOne && parseDecryptedValue(result[roundData.diceOne]);
        const diceTwo = roundData.diceTwo && parseDecryptedValue(result[roundData.diceTwo]);
        const total = roundData.total && parseDecryptedValue(result[roundData.total]);
        const guess = roundData.guessedBig && parseDecryptedBool(result[roundData.guessedBig]);
        const correct = roundData.wasCorrect && parseDecryptedBool(result[roundData.wasCorrect]);

        decrypted.diceOne = diceOne !== undefined ? Number(diceOne) : undefined;
        decrypted.diceTwo = diceTwo !== undefined ? Number(diceTwo) : undefined;
        decrypted.total = total !== undefined ? Number(total) : undefined;
        decrypted.guessedBig = guess;
        decrypted.wasCorrect = correct;
      }

      if (latestErrorCipher) {
        const code = parseDecryptedValue(result[latestErrorCipher.code]);
        if (code !== undefined) {
          decrypted.errorCode = Number(code);
        }
        decrypted.timestamp = latestErrorCipher.timestamp ? Number(latestErrorCipher.timestamp) : undefined;
      }

      setSecureData(decrypted);
      updateStatus('Values decrypted successfully.');
    } catch (error) {
      console.error('Decryption failed', error);
      updateStatus(error instanceof Error ? error.message : 'Failed to decrypt values.');
    } finally {
      setDecrypting(false);
    }
  };

  const lastErrorData = lastErrorQuery.data as unknown as LastErrorResponse | undefined;
  const lastErrorTimestamp = lastErrorData ? Number(lastErrorData.timestamp || 0n) : 0;

  return (
    <div className="vault-app">
      <section className="vault-grid">
        <div className="vault-card highlight-card">
          <div className="card-header">
            <div>
              <h2>Buy Vault Points</h2>
              <p>Every 1 ETH gives you {POINTS_PER_ETH} points. Each round adds or removes {ROUND_REWARD} points.</p>
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="ethInput">ETH to swap</label>
            <input
              id="ethInput"
              type="number"
              min="0"
              step="0.01"
              value={ethAmount}
              onChange={(event) => setEthAmount(event.target.value)}
              disabled={isDepositing || !isConnected}
            />
          </div>
          <div className="conversion-note">
            ≈ <strong>{conversionPreview}</strong> points
          </div>
          <button className="primary" onClick={handleDeposit} disabled={isDepositing || !isConnected}>
            {isDepositing ? 'Processing...' : 'Purchase Points'}
          </button>
          <ul className="tips">
            <li>Points are encrypted with Zama FHEVM.</li>
            <li>Your wallet never sees dice rolls until you request decryption.</li>
          </ul>
        </div>

        <div className="vault-card action-card">
          <div className="card-header">
            <div>
              <h2>Play a Round</h2>
              <p>Choose Big (≥7) or Small (&lt;7). Result affects your balance by {ROUND_REWARD} points.</p>
            </div>
          </div>
          <div className="action-buttons">
            <button onClick={() => handleGuess('small')} disabled={isGuessing || !isConnected} className="secondary">
              {isGuessing ? 'Rolling...' : 'Guess Small'}
            </button>
            <button onClick={() => handleGuess('big')} disabled={isGuessing || !isConnected} className="primary">
              {isGuessing ? 'Rolling...' : 'Guess Big'}
            </button>
          </div>
          <div className="status-line">
            <p>
              Encryption service:{' '}
              {zamaLoading
                ? 'initializing...'
                : zamaError
                  ? 'unavailable'
                  : instance
                    ? 'ready'
                    : 'not available'}
            </p>
            <p>Connected account: {address ?? '—'}</p>
          </div>
        </div>

        <div className="vault-card">
          <div className="card-header">
            <div>
              <h2>On-chain Ciphertexts</h2>
              <p>Decrypt them with Zama to reveal human-readable values.</p>
            </div>
            <button onClick={handleDecrypt} disabled={decrypting || !isConnected || zamaLoading} className="outline">
              {decrypting ? 'Decrypting...' : 'Decrypt my data'}
            </button>
          </div>
          <div className="cipher-row">
            <span>Encrypted balance</span>
            <code>{balanceQuery.data ?? '—'}</code>
          </div>
          <div className="cipher-row">
            <span>Latest round</span>
            <code>{roundQuery.data ? JSON.stringify(roundQuery.data) : '—'}</code>
          </div>
          <div className="cipher-row">
            <span>Error handle</span>
            <code>{lastErrorData?.code ?? '—'}</code>
          </div>
          <div className="secure-result">
            <h3>Decryption Result</h3>
            {secureData ? (
              <ul>
                <li>Balance: {secureData.balancePoints ?? '—'} pts</li>
                <li>
                  Dice: {secureData.diceOne ?? '—'} + {secureData.diceTwo ?? '—'} = {secureData.total ?? '—'}
                </li>
                <li>
                  Guess: {secureData.guessedBig === undefined ? '—' : secureData.guessedBig ? 'Big' : 'Small'}
                </li>
                <li>
                  Outcome:{' '}
                  {secureData.wasCorrect === undefined ? '—' : secureData.wasCorrect ? 'Correct ✓' : 'Incorrect ✗'}
                </li>
                <li>
                  Last error:{' '}
                  {secureData.errorCode !== undefined
                    ? ERROR_MESSAGES[secureData.errorCode] ?? `Code ${secureData.errorCode}`
                    : '—'}
                </li>
                <li>Updated at: {formatTimestamp(secureData.timestamp)}</li>
              </ul>
            ) : (
              <p className="empty-state">Decrypt to view your hidden balance and dice rolls.</p>
            )}
          </div>
        </div>

        <div className="vault-card mini-card">
          <h3>Latest On-chain Status</h3>
          <div className="stats-row">
            <span>Balance handle ready:</span>
            <strong>{balanceQuery.data && balanceQuery.data !== ZERO_HANDLE ? 'Yes' : 'No'}</strong>
          </div>
          <div className="stats-row">
            <span>Last round timestamp:</span>
            <strong>{formatTimestamp(lastErrorTimestamp)}</strong>
          </div>
          <div className="stats-row">
            <span>Contract address:</span>
            <code>{CONTRACT_ADDRESS}</code>
          </div>
        </div>
      </section>

      {statusMessage && <div className="banner">{statusMessage}</div>}
    </div>
  );
}
