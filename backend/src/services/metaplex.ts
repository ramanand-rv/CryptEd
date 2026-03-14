import {
  Metaplex,
  keypairIdentity,
  irysStorage,
} from "@metaplex-foundation/js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// Load fee payer keypair from environment variable (base58 encoded private key)
const FEE_PAYER_SECRET_KEY = process.env.FEE_PAYER_SECRET_KEY;
if (!FEE_PAYER_SECRET_KEY) throw new Error("FEE_PAYER_SECRET_KEY not set");

const secretKey = bs58.decode(FEE_PAYER_SECRET_KEY);
const feePayer = Keypair.fromSecretKey(new Uint8Array(secretKey));

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
);

const metaplex = Metaplex.make(connection)
  .use(keypairIdentity(feePayer))
  .use(irysStorage({ address: "https://devnet.irys.xyz" })); // for metadata storage

export async function mintCourseCompletionNFT(
  recipientAddress: string,
  metadataUri: string,
  courseTitle: string,
): Promise<string> {
  try {
    const { nft } = await metaplex.nfts().create({
      uri: metadataUri,
      name: `${courseTitle} Completion NFT`,
      sellerFeeBasisPoints: 0, // no royalties
      symbol: "EDU",
      tokenOwner: new PublicKey(recipientAddress), // mint directly to learner
    });
    return nft.address.toString();
  } catch (err) {
    console.error("NFT minting error:", err);
    throw err;
  }
}
