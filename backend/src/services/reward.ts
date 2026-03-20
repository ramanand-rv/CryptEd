import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  Keypair,
} from "@solana/web3.js";
import bs58 from "bs58";
import Course from "../models/Course.js";
import User from "../models/User.js";

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
);

const getFeePayer = () => {
  const rawKey = process.env.FEE_PAYER_SECRET_KEY || "";
  const normalizedKey = rawKey.replace(/^"|"$/g, "").trim();
  if (!normalizedKey) {
    throw new Error("FEE_PAYER_SECRET_KEY not set");
  }
  const secretKey = bs58.decode(normalizedKey);
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
};

export async function distributeReward(courseId: string, userId: string) {
  const course = await Course.findById(courseId);
  if (!course || !course.rewardPool) return;

  const { totalAmount, remaining, winnersCount, winners } = course.rewardPool;
  if (remaining <= 0) return;

  // Check if user already won
  if (winners.includes(userId as any)) return;

  // Check if winners count reached
  if (winners.length >= winnersCount) return;

  // Determine reward amount (simple equal split for demo)
  const rewardAmount = Math.floor(totalAmount / winnersCount);

  if (rewardAmount <= 0) return;

  // Get user's wallet address
  const user = await User.findById(userId);
  if (!user?.walletAddress) return;

  try {
    const feePayer = getFeePayer();

    // Transfer SOL from fee payer to user
    const transferTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: feePayer.publicKey,
        toPubkey: new PublicKey(user.walletAddress),
        lamports: rewardAmount,
      }),
    );

    const signature = await connection.sendTransaction(transferTx, [feePayer]);
    await connection.confirmTransaction(signature, "confirmed");

    // Update course reward pool
    course.rewardPool.remaining -= rewardAmount;
    course.rewardPool.winners.push(userId as any);
    await course.save();

    console.log(
      `Reward sent to ${user.walletAddress}: ${rewardAmount / LAMPORTS_PER_SOL} SOL, tx: ${signature}`,
    );
  } catch (err) {
    console.error("Reward distribution error:", err);
  }
}
