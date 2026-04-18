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

type WinnerEntry =
  | string
  | { toString(): string }
  | {
      userId?: string | { toString(): string };
      walletAddress?: string;
      amount?: number;
      txSignature?: string;
      awardedAt?: Date | string;
    };

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

const getWinnerUserId = (winner: WinnerEntry): string => {
  if (winner && typeof winner === "object" && "userId" in winner) {
    const rawUserId = winner.userId;
    if (!rawUserId) return "";
    return rawUserId.toString();
  }
  return winner ? winner.toString() : "";
};

export async function distributeReward(courseId: string, userId: string) {
  const course = await Course.findById(courseId);
  if (!course || !course.rewardPool) return;

  const educator = await User.findById(course.educatorId);
  if (!educator?.walletVerifiedAt) return;

  const { totalAmount, remaining, winnersCount, winners } = course.rewardPool;
  const eligibleWinners = Math.max(0, winnersCount || 0);
  if (eligibleWinners <= 0) return;
  if (remaining <= 0) return;

  // Check if user already won
  if (winners.some((winner) => getWinnerUserId(winner as WinnerEntry) === userId)) {
    return;
  }

  // Check if winners count reached
  if (winners.length >= eligibleWinners) return;

  // Determine reward amount (simple equal split for demo)
  const rewardAmount = Math.floor(totalAmount / eligibleWinners);

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
    course.rewardPool.remaining = Math.max(0, course.rewardPool.remaining - rewardAmount);
    course.rewardPool.winners.push({
      userId: user._id,
      walletAddress: user.walletAddress,
      amount: rewardAmount,
      txSignature: signature,
      awardedAt: new Date(),
    } as any);
    await course.save();

    console.log(
      `Reward sent to ${user.walletAddress}: ${rewardAmount / LAMPORTS_PER_SOL} SOL, tx: ${signature}`,
    );
  } catch (err) {
    console.error("Reward distribution error:", err);
  }
}
