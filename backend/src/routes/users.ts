import express from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import Course from "../models/Course.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { TextEncoder } from "util";
import { getCourseCompletionNFT } from "../services/metaplex.js";
import {
  buildVerifyUrl,
  findCertificateByMint,
  type CertificateResponse,
  toCertificateResponse,
} from "../services/certificates.js";

const router = express.Router();

const getApiBaseUrl = (req: any) => `${req.protocol}://${req.get("host")}`;

const isCertificateResponse = (
  value: CertificateResponse | null,
): value is CertificateResponse => Boolean(value);

const toSafeUser = (user: any, apiBaseUrl?: string) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  about: user.about,
  website: user.website,
  linkedin: user.linkedin,
  twitter: user.twitter,
  role: user.role,
  walletAddress: user.walletAddress,
  walletVerifiedAt: user.walletVerifiedAt,
  completedCourses: user.completedCourses || [],
  ownedNFTs: ((user.ownedNFTs || []) as unknown[])
    .map((entry) => toCertificateResponse(entry, apiBaseUrl))
    .filter(isCertificateResponse),
});

const WALLET_NONCE_TTL_MS = 10 * 60 * 1000;

const buildWalletMessage = (
  walletAddress: string,
  nonce: string,
  issuedAt: string,
) => `CryptEd wallet verification
Wallet: ${walletAddress}
Nonce: ${nonce}
Issued at: ${issuedAt}
`;

router.get("/me", auth, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(toSafeUser(user, getApiBaseUrl(req)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me/certificates", auth, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.userId).select("ownedNFTs");
    if (!user) return res.status(404).json({ msg: "User not found" });

    const apiBaseUrl = getApiBaseUrl(req);
    const certificates = ((user.ownedNFTs || []) as unknown[])
      .map((entry) => toCertificateResponse(entry, apiBaseUrl))
      .filter(isCertificateResponse);

    res.json({ certificates });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/me", auth, async (req: any, res) => {
  try {
    const {
      name,
      walletAddress,
      about,
      website,
      linkedin,
      twitter,
    } = req.body;
    const updates: Record<string, any> = {};

    if (name !== undefined) updates.name = name;
    if (walletAddress !== undefined) updates.walletAddress = walletAddress;
    if (about !== undefined) updates.about = about;
    if (website !== undefined) updates.website = website;
    if (linkedin !== undefined) updates.linkedin = linkedin;
    if (twitter !== undefined) updates.twitter = twitter;

    if (walletAddress !== undefined) {
      updates.walletVerifiedAt = undefined;
      updates.walletNonce = undefined;
      updates.walletNonceCreatedAt = undefined;
      updates.walletVerificationMessage = undefined;
    }

    const user = await User.findByIdAndUpdate(req.user.userId, updates, {
      new: true,
      select: "-password",
    });

    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(toSafeUser(user, getApiBaseUrl(req)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/me/password", auth, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ msg: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ msg: "Current password is required" });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Current password is incorrect" });
      }
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/me/wallet/challenge", auth, async (req: any, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ msg: "Wallet address is required" });
    }

    try {
      // Validate base58 address
      new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({ msg: "Invalid wallet address" });
    }

    const existingUser = await User.findOne({
      walletAddress,
      _id: { $ne: req.user.userId },
    });
    if (existingUser) {
      return res.status(400).json({ msg: "Wallet already in use" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const nonce = crypto.randomBytes(16).toString("hex");
    const issuedAt = new Date().toISOString();
    const message = buildWalletMessage(walletAddress, nonce, issuedAt);

    user.walletAddress = walletAddress;
    user.walletNonce = nonce;
    user.walletNonceCreatedAt = new Date(issuedAt);
    user.walletVerificationMessage = message;
    user.walletVerifiedAt = undefined;
    await user.save();

    res.json({ message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/me/wallet/verify", auth, async (req: any, res) => {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature) {
      return res
        .status(400)
        .json({ msg: "Wallet address and signature are required" });
    }

    try {
      new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({ msg: "Invalid wallet address" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (!user.walletNonce || !user.walletVerificationMessage) {
      return res.status(400).json({ msg: "No wallet challenge found" });
    }

    if (user.walletAddress !== walletAddress) {
      return res.status(400).json({ msg: "Wallet address mismatch" });
    }

    const nonceCreatedAt = user.walletNonceCreatedAt?.getTime() || 0;
    if (Date.now() - nonceCreatedAt > WALLET_NONCE_TTL_MS) {
      return res.status(400).json({ msg: "Wallet challenge expired" });
    }

    let isValid = false;
    try {
      const messageBytes = new TextEncoder().encode(
        user.walletVerificationMessage,
      );
      const signatureBytes = bs58.decode(signature);
      const publicKeyBytes = new PublicKey(walletAddress).toBytes();
      isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes,
      );
    } catch {
      return res.status(400).json({ msg: "Invalid signature format" });
    }

    if (!isValid) {
      return res.status(400).json({ msg: "Invalid signature" });
    }

    user.walletVerifiedAt = new Date();
    user.walletNonce = undefined;
    user.walletNonceCreatedAt = undefined;
    user.walletVerificationMessage = undefined;
    await user.save();

    res.json(toSafeUser(user, getApiBaseUrl(req)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/certificates/:mintAddress/verify", async (req, res) => {
  try {
    const mintAddress = (req.params.mintAddress || "").trim();
    if (!mintAddress) {
      return res.status(400).json({ msg: "Mint address is required" });
    }

    const user = await User.findOne({
      $or: [{ ownedNFTs: mintAddress }, { "ownedNFTs.mintAddress": mintAddress }],
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        valid: false,
        msg: "Certificate not found",
      });
    }

    const certificate = findCertificateByMint(
      (user.ownedNFTs || []) as unknown[],
      mintAddress,
    );

    let courseTitle = certificate?.courseTitle;
    if (!courseTitle && certificate?.courseId) {
      const course = await Course.findById(certificate.courseId).select("title");
      courseTitle = course?.title;
    }

    let onChainOwnerAddress: string | undefined;
    let onChainMetadataUri: string | undefined;
    let verificationError: string | undefined;

    try {
      const onChainData = await getCourseCompletionNFT(mintAddress);
      onChainOwnerAddress = onChainData.ownerAddress;
      onChainMetadataUri = onChainData.metadataUri;
    } catch (err: any) {
      verificationError = err?.message || "Failed to verify on-chain data";
    }

    const ownerMatchesWallet =
      Boolean(user.walletAddress) &&
      Boolean(onChainOwnerAddress) &&
      user.walletAddress === onChainOwnerAddress;

    res.json({
      valid: true,
      certificate: {
        ...(toCertificateResponse(certificate || mintAddress, getApiBaseUrl(req)) || {
          mintAddress,
          verifyUrl: buildVerifyUrl(getApiBaseUrl(req), mintAddress),
        }),
        courseTitle,
        metadataUri: certificate?.metadataUri || onChainMetadataUri,
      },
      owner: {
        userId: user._id,
        name: user.name,
        walletAddress: user.walletAddress,
      },
      verification: {
        onChainChecked: !verificationError,
        ownerMatchesWallet,
        onChainOwnerAddress,
        error: verificationError,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
