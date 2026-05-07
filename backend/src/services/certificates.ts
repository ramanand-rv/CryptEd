import mongoose from "mongoose";

export interface OwnedNFTRecord {
  mintAddress: string;
  courseId?: string;
  courseTitle?: string;
  metadataUri?: string;
  metadataName?: string;
  metadataDescription?: string;
  metadataAttributes?: Array<{
    trait_type: string;
    value: string;
  }>;
  mintedAt?: Date;
}

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asDate = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const asIdString = (value: unknown): string | undefined => {
  const asTrimmedString = asString(value);
  if (asTrimmedString) return asTrimmedString;

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  if (value && typeof value === "object" && "toString" in value) {
    const objectValue = value as { toString: () => string };
    const text = objectValue.toString();
    if (text && text !== "[object Object]") return text;
  }

  return undefined;
};

export const normalizeOwnedNFTEntry = (entry: unknown): OwnedNFTRecord | null => {
  if (typeof entry === "string") {
    const mintAddress = asString(entry);
    if (!mintAddress) return null;
    return { mintAddress };
  }

  const raw = asObject(entry);
  if (!raw) return null;

  const mintAddress = asString(raw.mintAddress);
  if (!mintAddress) return null;

  const courseId = asIdString(raw.courseId);
  const courseTitle = asString(raw.courseTitle);
  const metadataUri = asString(raw.metadataUri);
  const metadataName = asString(raw.metadataName);
  const metadataDescription = asString(raw.metadataDescription);
  const metadataAttributes = Array.isArray(raw.metadataAttributes)
    ? raw.metadataAttributes
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return null;
          }
          const item = entry as Record<string, unknown>;
          const trait_type = asString(item.trait_type);
          const value = asString(item.value);
          if (!trait_type || !value) return null;
          return { trait_type, value };
        })
        .filter(
          (
            entry,
          ): entry is {
            trait_type: string;
            value: string;
          } => Boolean(entry),
        )
    : undefined;
  const mintedAt = asDate(raw.mintedAt);

  return {
    mintAddress,
    courseId,
    courseTitle,
    metadataUri,
    metadataName,
    metadataDescription,
    metadataAttributes,
    mintedAt,
  };
};

export const normalizeOwnedNFTEntries = (entries: unknown[] = []) =>
  entries
    .map((entry) => normalizeOwnedNFTEntry(entry))
    .filter((entry): entry is OwnedNFTRecord => Boolean(entry));

export const asCourseIdString = (courseId: mongoose.Types.ObjectId | string) =>
  typeof courseId === "string" ? courseId : courseId.toString();

export const hasCertificateForCourse = (
  entries: unknown[] = [],
  courseId: mongoose.Types.ObjectId | string,
) => {
  const target = asCourseIdString(courseId);
  return normalizeOwnedNFTEntries(entries).some(
    (entry) => entry.courseId && entry.courseId === target,
  );
};

export const hasCertificateMint = (entries: unknown[] = [], mintAddress: string) =>
  normalizeOwnedNFTEntries(entries).some(
    (entry) => entry.mintAddress === mintAddress,
  );

export const findCertificateByMint = (entries: unknown[] = [], mintAddress: string) =>
  normalizeOwnedNFTEntries(entries).find(
    (entry) => entry.mintAddress === mintAddress,
  );

const getClusterFromRpc = () => {
  const rpc = (process.env.SOLANA_RPC_URL || "").toLowerCase();
  if (rpc.includes("devnet")) return "devnet";
  if (rpc.includes("testnet")) return "testnet";
  return "mainnet-beta";
};

export const buildExplorerAddressUrl = (mintAddress: string) => {
  const cluster = getClusterFromRpc();
  if (cluster === "mainnet-beta") {
    return `https://explorer.solana.com/address/${mintAddress}`;
  }
  return `https://explorer.solana.com/address/${mintAddress}?cluster=${cluster}`;
};

export const buildVerifyUrl = (apiBaseUrl: string, mintAddress: string) =>
  `${apiBaseUrl}/api/users/certificates/${encodeURIComponent(mintAddress)}/verify`;

export interface CertificateResponse {
  mintAddress: string;
  courseId?: string;
  courseTitle?: string;
  metadataUri?: string;
  metadataName?: string;
  metadataDescription?: string;
  metadataAttributes?: Array<{
    trait_type: string;
    value: string;
  }>;
  mintedAt?: string;
  explorerUrl: string;
  verifyUrl?: string;
}

export const toCertificateResponse = (
  entry: unknown,
  apiBaseUrl?: string,
): CertificateResponse | null => {
  const normalized = normalizeOwnedNFTEntry(entry);
  if (!normalized) return null;

  return {
    mintAddress: normalized.mintAddress,
    courseId: normalized.courseId,
    courseTitle: normalized.courseTitle,
    metadataUri: normalized.metadataUri,
    metadataName: normalized.metadataName,
    metadataDescription: normalized.metadataDescription,
    metadataAttributes: normalized.metadataAttributes,
    mintedAt: normalized.mintedAt?.toISOString(),
    explorerUrl: buildExplorerAddressUrl(normalized.mintAddress),
    verifyUrl: apiBaseUrl
      ? buildVerifyUrl(apiBaseUrl, normalized.mintAddress)
      : undefined,
  };
};
