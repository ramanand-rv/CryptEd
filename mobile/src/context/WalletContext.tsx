import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import {
  Keypair,
  PublicKey,
  Transaction,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

interface WalletContextType {
  connected: boolean;
  publicKey: PublicKey | null;
  connect: (usePhantom?: boolean) => Promise<void>;
  disconnect: () => void;
  signAndSendTransaction: (transaction: Transaction) => Promise<string | null>;
  balance: number | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const connection = new Connection("https://api.devnet.solana.com");

  // Load saved keypair from secure storage (demo mode)
  useEffect(() => {
    const loadKeypair = async () => {
      const stored = await SecureStore.getItemAsync("demo_keypair");
      if (stored) {
        const secretKey = Uint8Array.from(JSON.parse(stored));
        const kp = Keypair.fromSecretKey(secretKey);
        setKeypair(kp);
        setPublicKey(kp.publicKey);
        setConnected(true);
        fetchBalance(kp.publicKey);
      }
    };
    loadKeypair();
  }, []);

  const fetchBalance = async (pubkey: PublicKey) => {
    try {
      const bal = await connection.getBalance(pubkey);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error(err);
    }
  };

  const connect = async (usePhantom: boolean = false) => {
    if (usePhantom) {
      // Deep link to Phantom
      const redirectUri = Linking.createURL("solana-education");
      const phantomUrl = `phantom://browse?ref=${encodeURIComponent(redirectUri)}`; // Phantom deep link scheme
      // For demonstration, we just open Phantom. In a real app, you'd need to handle the callback with transaction signing.
      // We'll simplify: assume Phantom is connected and we get a public key via deeplink callback? Actually it's complex.
      // For hackathon, we'll stick with demo mode but mention Phantom integration.
      await WebBrowser.openBrowserAsync(phantomUrl);
      // In practice, you'd use Phantom's deeplink for signing, but getting public key requires the mobile wallet adapter.
      // We'll skip full Phantom integration for now to save time, but you can mention it as a future enhancement.
      alert("Phantom not fully integrated yet. Using demo mode.");
      usePhantom = false;
    }

    if (!usePhantom) {
      // Demo mode: generate or load keypair
      let kp = keypair;
      if (!kp) {
        kp = Keypair.generate();
        await SecureStore.setItemAsync(
          "demo_keypair",
          JSON.stringify(Array.from(kp.secretKey)),
        );
        setKeypair(kp);
      }
      setPublicKey(kp.publicKey);
      setConnected(true);
      fetchBalance(kp.publicKey);
    }
  };

  const disconnect = async () => {
    await SecureStore.deleteItemAsync("demo_keypair");
    setKeypair(null);
    setPublicKey(null);
    setConnected(false);
    setBalance(null);
  };

  const signAndSendTransaction = async (
    transaction: Transaction,
  ): Promise<string | null> => {
    if (!keypair || !publicKey) return null;

    try {
      transaction.feePayer = publicKey;
      const blockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash.blockhash;
      transaction.sign(keypair);
      const signature = await connection.sendRawTransaction(
        transaction.serialize(),
      );
      await connection.confirmTransaction(signature, "confirmed");
      fetchBalance(publicKey); // update balance
      return signature;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        connected,
        publicKey,
        connect,
        disconnect,
        signAndSendTransaction,
        balance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within WalletProvider");
  return context;
};
