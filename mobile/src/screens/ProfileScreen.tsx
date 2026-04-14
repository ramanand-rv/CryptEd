import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import axios from "axios";

const API_BASE_URL = "http://localhost:5000";

interface NFTCertificate {
  mintAddress: string;
  courseTitle?: string;
  mintedAt?: string;
  explorerUrl?: string;
  verifyUrl?: string;
}

const normalizeCertificate = (entry: unknown): NFTCertificate | null => {
  if (typeof entry === "string") {
    const mintAddress = entry.trim();
    if (!mintAddress) return null;
    return {
      mintAddress,
      verifyUrl: `${API_BASE_URL}/api/users/certificates/${encodeURIComponent(mintAddress)}/verify`,
    };
  }

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const raw = entry as Record<string, unknown>;
  const mintAddress =
    typeof raw.mintAddress === "string" ? raw.mintAddress.trim() : "";
  if (!mintAddress) return null;

  return {
    mintAddress,
    courseTitle:
      typeof raw.courseTitle === "string" ? raw.courseTitle : undefined,
    mintedAt: typeof raw.mintedAt === "string" ? raw.mintedAt : undefined,
    explorerUrl:
      typeof raw.explorerUrl === "string" ? raw.explorerUrl : undefined,
    verifyUrl:
      typeof raw.verifyUrl === "string"
        ? raw.verifyUrl
        : `${API_BASE_URL}/api/users/certificates/${encodeURIComponent(mintAddress)}/verify`,
  };
};

const shortenMint = (mintAddress: string) =>
  `${mintAddress.slice(0, 8)}...${mintAddress.slice(-4)}`;

const formatMintedAt = (mintedAt?: string) => {
  if (!mintedAt) return null;
  const date = new Date(mintedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

const ProfileScreen = () => {
  const { user, token } = useAuth();
  const { publicKey, balance } = useWallet();
  const [nfts, setNfts] = useState<NFTCertificate[]>([]);

  useEffect(() => {
    fetchUserNFTs();
  }, []);

  const fetchUserNFTs = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users/me`, {
        headers: { "x-auth-token": token },
      });
      const ownedNFTs = Array.isArray(res.data?.ownedNFTs)
        ? (res.data.ownedNFTs as unknown[])
        : [];

      const normalized = ownedNFTs
        .map((entry) => normalizeCertificate(entry))
        .filter((entry): entry is NFTCertificate => Boolean(entry));

      setNfts(normalized);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareCertificate = async (item: NFTCertificate) => {
    try {
      const verifyUrl =
        item.verifyUrl ||
        `${API_BASE_URL}/api/users/certificates/${encodeURIComponent(item.mintAddress)}/verify`;
      const courseName = item.courseTitle || "Course";
      await Share.share({
        message: `I earned an on-chain completion certificate for ${courseName}.\nVerify: ${verifyUrl}`,
      });
    } catch (err) {
      console.error(err);
      Alert.alert("Share failed", "Unable to share this certificate right now.");
    }
  };

  const handleVerifyCertificate = async (item: NFTCertificate) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/users/certificates/${encodeURIComponent(item.mintAddress)}/verify`,
      );
      const verification = res.data?.verification;
      const valid = res.data?.valid;
      if (valid && verification?.onChainChecked && verification?.ownerMatchesWallet) {
        Alert.alert("Verified", "Certificate is valid and ownership is confirmed.");
        return;
      }
      if (valid && verification?.onChainChecked) {
        Alert.alert("Partially verified", "Certificate exists, but owner wallet mismatch was detected.");
        return;
      }
      Alert.alert("Verification pending", "Certificate found but on-chain verification is unavailable right now.");
    } catch (err) {
      console.error(err);
      Alert.alert("Verification failed", "Could not verify this certificate.");
    }
  };

  const renderNFT = ({ item }: { item: NFTCertificate }) => (
    <View style={styles.nftCard}>
      <View style={styles.nftPlaceholder} />
      <Text style={styles.nftTitle}>{item.courseTitle || "Course Completion"}</Text>
      <Text style={styles.nftText}>{shortenMint(item.mintAddress)}</Text>
      {formatMintedAt(item.mintedAt) && (
        <Text style={styles.nftMeta}>Minted {formatMintedAt(item.mintedAt)}</Text>
      )}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShareCertificate(item)}
        >
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButtonSecondary}
          onPress={() => handleVerifyCertificate(item)}
        >
          <Text style={styles.actionLabelSecondary}>Verify</Text>
        </TouchableOpacity>
      </View>
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
  nftTitle: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  nftText: { fontSize: 12, color: "#333" },
  nftMeta: { fontSize: 11, color: "#6b7280", marginTop: 4 },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionButtonSecondary: {
    borderColor: "#9ca3af",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionLabel: { color: "white", fontSize: 11, fontWeight: "600" },
  actionLabelSecondary: { color: "#374151", fontSize: 11, fontWeight: "600" },
  empty: { textAlign: "center", color: "#999", marginTop: 20 },
});

export default ProfileScreen;
