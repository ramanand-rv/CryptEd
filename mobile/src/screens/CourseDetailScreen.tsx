import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const CourseDetailScreen = ({ route, navigation }: any) => {
  const { courseId } = route.params;
  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();
  const { connected, publicKey, connect, signAndSendTransaction, balance } =
    useWallet();

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
      {connected && (
        <Text>
          Wallet: {publicKey?.toBase58().slice(0, 8)}... Balance: {balance} SOL
        </Text>
      )}
      <Button title="Purchase Course" onPress={handlePurchase} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  description: { fontSize: 16, marginBottom: 16 },
  price: { fontSize: 18, color: "#2ecc71", marginBottom: 8 },
});

export default CourseDetailScreen;
