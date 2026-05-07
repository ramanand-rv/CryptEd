import {
  Metaplex,
  keypairIdentity,
  irysStorage,
} from "@metaplex-foundation/js";
import {
  Connection,
  Keypair,
  ParsedAccountData,
  PublicKey,
} from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";

dotenv.config();

let metaplex: Metaplex | null = null;

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

const getMetaplex = () => {
  if (!metaplex) {
    const feePayer = getFeePayer();
    metaplex = Metaplex.make(connection)
      .use(keypairIdentity(feePayer))
      .use(irysStorage({ address: "https://devnet.irys.xyz" }));
  }
  return metaplex;
};

export async function mintCourseCompletionNFT(
  recipientAddress: string,
  metadataUri: string,
  courseTitle: string,
): Promise<string> {
  try {
    const { nft } = await getMetaplex().nfts().create({
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

export interface OnChainCertificateData {
  mintAddress: string;
  metadataUri?: string;
  ownerAddress?: string;
}

export async function getCourseCompletionNFT(
  mintAddress: string,
): Promise<OnChainCertificateData> {
  const mintPublicKey = new PublicKey(mintAddress);
  const nft = await getMetaplex().nfts().findByMint({ mintAddress: mintPublicKey });
  const largestAccounts = await connection.getTokenLargestAccounts(mintPublicKey);

  let ownerAddress: string | undefined;
  const ownerTokenAccount = largestAccounts.value.find((account) => account.amount === "1");

  if (ownerTokenAccount?.address) {
    const tokenAccountInfo = await connection.getParsedAccountInfo(
      ownerTokenAccount.address,
    );
    const parsedData = tokenAccountInfo.value?.data;
    if (parsedData && "parsed" in parsedData) {
      const info = (parsedData as ParsedAccountData).parsed?.info as
        | Record<string, unknown>
        | undefined;
      const owner = info?.owner;
      if (typeof owner === "string") {
        ownerAddress = owner;
      }
    }
  }

  return {
    mintAddress,
    metadataUri: nft.uri,
    ownerAddress,
  };
}
