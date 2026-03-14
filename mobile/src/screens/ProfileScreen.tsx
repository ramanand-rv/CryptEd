import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import axios from "axios";

interface NFT {
  mintAddress: string;
  name?: string;
  image?: string;
}

const ProfileScreen = () => {
  const { user, token } = useAuth();
  const { publicKey, balance } = useWallet();
  const [nfts, setNfts] = useState<NFT[]>([]);

  useEffect(() => {
    fetchUserNFTs();
  }, []);

  const fetchUserNFTs = async () => {
    try {
      // Fetch user data including ownedNFTs
      const res = await axios.get("http://localhost:5000/api/users/me", {
        headers: { "x-auth-token": token },
      });
      const ownedMints = res.data.ownedNFTs || [];

      // For each mint address, fetch metadata 
    //   displaying only mint address abhi ke liye
      setNfts(ownedMints.map((mint: string) => ({ mintAddress: mint })));
    } catch (err) {
      console.error(err);
    }
  };

  const renderNFT = ({ item }: { item: NFT }) => (
    <View style={styles.nftCard}>
      <View style={styles.nftPlaceholder} />
      <Text style={styles.nftText}>
        {item.mintAddress.slice(0, 8)}...{item.mintAddress.slice(-4)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{user?.name}</Text>
        {publicKey && (
          <Text style={styles.wallet}>
            Wallet: {publicKey.toBase58().slice(0, 8)}... Balance: {balance} SOL
          </Text>
        )}
      </View>
      <Text style={styles.sectionTitle}>Earned NFTs</Text>
      {nfts.length === 0 ? (
        <Text style={styles.empty}>
          No NFTs yet. Complete courses to earn them!
        </Text>
      ) : (
        <FlatList
          data={nfts}
          keyExtractor={(item) => item.mintAddress}
          renderItem={renderNFT}
          numColumns={2}
          contentContainerStyle={styles.nftGrid}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 16 },
  header: { marginBottom: 24 },
  name: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  wallet: { fontSize: 14, color: "#666" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  nftGrid: { gap: 12 },
  nftCard: {
    flex: 1,
    margin: 6,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  nftPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: "#ddd",
    borderRadius: 8,
    marginBottom: 8,
  },
  nftText: { fontSize: 12, color: "#333" },
  empty: { textAlign: "center", color: "#999", marginTop: 20 },
});

export default ProfileScreen;
