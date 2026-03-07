import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";
import { Keypair } from "@solana/web3.js";

const LoginScreen: React.FC = () => {
  const { loginWithWallet } = useAuth();

  const handleConnect = () => {
    // Demo: generate random keypair
    const keypair = Keypair.generate();
    const walletAddress = keypair.publicKey.toBase58();
    loginWithWallet(walletAddress, "Demo Learner");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Solana Edu</Text>
      <Button title="Connect Wallet (Demo)" onPress={handleConnect} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
});

export default LoginScreen;
