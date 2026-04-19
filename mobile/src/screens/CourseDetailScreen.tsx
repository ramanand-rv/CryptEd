import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import {
  Transaction,
  SystemProgram,
  PublicKey,
} from "@solana/web3.js";

const shortenWallet = (address?: string) =>
  address && address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address || "Wallet unavailable";

const CourseDetailScreen = ({ route, navigation }: any) => {
  const { courseId } = route.params;
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();
  const { connected, publicKey, connect, signAndSendTransaction, balance } =
    useWallet();

  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    checkIfPurchased();
  }, []);

  const checkIfPurchased = async () => {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/purchases/my-courses",
        {
          headers: { "x-auth-token": token },
        },
      );
      const purchasedCourses = res.data;
      setPurchased(purchasedCourses.some((c: any) => c._id === courseId));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, []);

  const fetchCourse = async () => {
    try {
      const res = await axios.get(
        `http://localhost:5000/api/courses/${courseId}`,
      );
      setCourse(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!connected) {
      Alert.alert("Connect Wallet", "Please connect your wallet first.", [
        { text: "Cancel" },
        { text: "Connect", onPress: () => connect(false) }, // demo mode
      ]);
      return;
    }

    if (!course) return;

    try {
      // Create a transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey!,
          toPubkey: new PublicKey("EducatorWalletAddressHere"), // you need to get educator's wallet from course.educatorId
          lamports: course.price,
        }),
      );

      const signature = await signAndSendTransaction(transaction);
      if (!signature) {
        Alert.alert("Error", "Transaction failed");
        return;
      }

      // Verify with backend
      await axios.post(
        "http://localhost:5000/api/purchases/verify",
        {
          courseId: course._id,
          transactionSignature: signature,
          expectedAmount: course.price,
        },
        {
          headers: { "x-auth-token": token },
        },
      );

      Alert.alert("Success", "Course purchased! You can now start learning.");
      // Navigate to course player (Day 4)
    } catch (err: any) {
      Alert.alert("Purchase failed", err.message);
    }
  };

  if (loading)
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  if (!course)
    return (
      <View style={styles.container}>
        <Text>Course not found</Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{course.title}</Text>
      <Text style={styles.description}>{course.description}</Text>
      <Text style={styles.price}>Price: {course.price / 1e9} SOL</Text>
      <Text>Educator: {course.educatorId?.name}</Text>
      {(course.rewardPool?.totalAmount || 0) > 0 && (
        <View style={styles.rewardsCard}>
          <Text style={styles.rewardsTitle}>Reward Pool</Text>
          <Text style={styles.rewardsText}>
            Total: {(course.rewardPool.totalAmount / 1e9).toFixed(2)} SOL
          </Text>
          <Text style={styles.rewardsText}>
            Remaining: {(course.rewardPool.remaining / 1e9).toFixed(2)} SOL
          </Text>
          <Text style={styles.rewardsText}>
            Winners: {course.rewardPool.totalWinners || 0}/
            {course.rewardPool.winnersCount || 0}
          </Text>
          <Text style={styles.rewardsSubtitle}>Recent winners</Text>
          {(course.recentWinners || []).length === 0 ? (
            <Text style={styles.rewardsMuted}>No payouts yet.</Text>
          ) : (
            (course.recentWinners || []).map((winner: any, index: number) => (
              <Text key={`${winner.userId}-${index}`} style={styles.rewardsText}>
                {winner.name || "Learner"} won{" "}
                {((winner.amount || 0) / 1e9).toFixed(3)} SOL (
                {shortenWallet(winner.walletAddress)})
              </Text>
            ))
          )}
        </View>
      )}
      {connected && (
        <Text>
          Wallet: {publicKey?.toBase58().slice(0, 8)}... Balance: {balance} SOL
        </Text>
      )}
      <Button title="Purchase Course" onPress={handlePurchase} />

      {purchased ? (
        <Button
          title="Continue Learning"
          onPress={() => navigation.navigate("CoursePlayer", { courseId })}
        />
      ) : (
        <Button title="Purchase Course" onPress={handlePurchase} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  description: { fontSize: 16, marginBottom: 16 },
  price: { fontSize: 18, color: "#2ecc71", marginBottom: 8 },
  rewardsCard: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  rewardsTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  rewardsSubtitle: { marginTop: 8, fontWeight: "600" },
  rewardsText: { fontSize: 13, color: "#065f46", marginTop: 2 },
  rewardsMuted: { fontSize: 13, color: "#6b7280" },
});

export default CourseDetailScreen;
