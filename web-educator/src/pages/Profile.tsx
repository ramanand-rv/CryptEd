import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const Profile: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  const { publicKey, connected, signMessage } = useWallet();
  const [name, setName] = useState(user?.name || "");
  const [about, setAbout] = useState(user?.about || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [linkedin, setLinkedin] = useState(user?.linkedin || "");
  const [twitter, setTwitter] = useState(user?.twitter || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [walletStatus, setWalletStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [verifyingWallet, setVerifyingWallet] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setAbout(user?.about || "");
    setWebsite(user?.website || "");
    setLinkedin(user?.linkedin || "");
    setTwitter(user?.twitter || "");
  }, [user]);

  const connectedAddress = publicKey?.toBase58() || "";
  const savedWallet = user?.walletAddress || "";
  const hasSavedWallet = Boolean(savedWallet);
  const formattedConnectedAddress = useMemo(() => {
    if (!connectedAddress) return "";
    return `${connectedAddress.slice(0, 4)}...${connectedAddress.slice(-4)}`;
  }, [connectedAddress]);
  const formattedSavedAddress = useMemo(() => {
    if (!savedWallet) return "";
    return `${savedWallet.slice(0, 4)}...${savedWallet.slice(-4)}`;
  }, [savedWallet]);

  const isWalletVerified = Boolean(user?.walletVerifiedAt);
  const isConnectedAndVerified =
    isWalletVerified && connectedAddress === user?.walletAddress;
  const walletState = useMemo(() => {
    if (!connected) {
      if (hasSavedWallet && isWalletVerified) {
        return {
          tone: "success" as const,
          message: "Saved wallet verified. Connect to manage or switch.",
        };
      }
      if (hasSavedWallet && !isWalletVerified) {
        return {
          tone: "warning" as const,
          message: "Saved wallet not verified yet. Connect to verify.",
        };
      }
      return {
        tone: "warning" as const,
        message: "No wallet connected. Connect to verify for rewards.",
      };
    }
    if (hasSavedWallet && connectedAddress !== savedWallet) {
      return {
        tone: "warning" as const,
        message: "Connected wallet doesn’t match saved wallet.",
      };
    }
    if (!hasSavedWallet) {
      return {
        tone: "warning" as const,
        message: "Connected wallet not saved yet. Click verify to link it.",
      };
    }
    if (!isWalletVerified) {
      return {
        tone: "warning" as const,
        message: "Saved wallet needs verification. Click verify to continue.",
      };
    }
    return {
      tone: "success" as const,
      message: "Wallet verified and ready for rewards.",
    };
  }, [connected, hasSavedWallet, isWalletVerified, connectedAddress, savedWallet]);

  const handleProfileSave = async () => {
    setStatus("");
    setSaving(true);
    try {
      await api.put(
        "/users/me",
        { name, about, website, linkedin, twitter },
        { headers: { "x-auth-token": token } },
      );
      await refreshUser();
      setStatus("Profile updated.");
    } catch (err) {
      console.error(err);
      setStatus("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleWalletVerify = async () => {
    setWalletStatus(null);
    if (!publicKey) {
      setWalletStatus({
        tone: "error",
        message: "Connect a wallet before verifying.",
      });
      return;
    }
    if (!signMessage) {
      setWalletStatus({
        tone: "error",
        message: "Your wallet does not support message signing.",
      });
      return;
    }

    setVerifyingWallet(true);
    try {
      const walletAddress = publicKey.toBase58();
      const challenge = await api.post(
        "/users/me/wallet/challenge",
        { walletAddress },
        { headers: { "x-auth-token": token } },
      );
      const message = challenge.data?.message;
      if (!message) {
        throw new Error("Missing verification message.");
      }
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signature);

      await api.post(
        "/users/me/wallet/verify",
        { walletAddress, signature: signatureBase58 },
        { headers: { "x-auth-token": token } },
      );
      await refreshUser();
      setWalletStatus({ tone: "success", message: "Wallet verified." });
    } catch (err: any) {
      console.error(err);
      setWalletStatus({
        tone: "error",
        message: err.response?.data?.msg || "Failed to verify wallet.",
      });
    } finally {
      setVerifyingWallet(false);
    }
  };

  const handlePasswordChange = async () => {
    setStatus("");
    setChangingPassword(true);
    try {
      await api.put(
        "/users/me/password",
        { currentPassword, newPassword },
        { headers: { "x-auth-token": token } },
      );
      setCurrentPassword("");
      setNewPassword("");
      setStatus("Password updated.");
    } catch (err) {
      console.error(err);
      setStatus("Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/dashboard" className="text-xs uppercase text-emerald-600">
              Back to dashboard
            </Link>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <h1 className="text-3xl font-semibold text-slate-900">
                Profile settings
              </h1>
              {isWalletVerified && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Verified
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-2">
              Update your account info, wallet, and password anytime.
            </p>
          </div>
        </div>

        {status && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {status}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Profile details
              </h2>
              <p className="text-xs text-slate-500">
                Keep your info current for payouts and support.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Full name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleProfileSave}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Wallet & rewards
              </h2>
              <p className="text-xs text-slate-500">
                Verify your wallet to enable rewards and NFT minting.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <WalletMultiButton className="!rounded-full !bg-emerald-600 !px-5 !py-2 !text-sm !font-semibold !text-white hover:!bg-emerald-700" />
                {connected && (
                  <span className="text-xs text-slate-600">
                    Connected: {formattedConnectedAddress}
                  </span>
                )}
              </div>
              {hasSavedWallet && (
                <div className="text-xs text-slate-500">
                  Saved wallet: {formattedSavedAddress}
                </div>
              )}
              {isWalletVerified && user?.walletVerifiedAt && (
                <div className="text-xs text-emerald-700">
                  Verified on {new Date(user.walletVerifiedAt).toLocaleString()}
                </div>
              )}
              <button
                type="button"
                disabled={
                  verifyingWallet || !connected || isConnectedAndVerified
                }
                onClick={handleWalletVerify}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700 transition disabled:opacity-70"
              >
                {isConnectedAndVerified
                  ? "Wallet verified"
                  : verifyingWallet
                    ? "Verifying..."
                    : "Verify wallet"}
              </button>
              {walletState && (
                <p
                  className={`text-xs ${
                    walletState.tone === "success"
                      ? "text-emerald-700"
                      : walletState.tone === "warning"
                        ? "text-amber-600"
                        : "text-rose-600"
                  }`}
                >
                  {walletState.message}
                </p>
              )}
              {walletStatus && (
                <p
                  className={`text-xs ${walletStatus.tone === "success" ? "text-emerald-700" : "text-rose-600"}`}
                >
                  {walletStatus.message}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Educator bio
              </h2>
              <p className="text-xs text-slate-500">
                Share a short description learners will see on your profile.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  About you
                </label>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={5}
                  maxLength={280}
                  className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Describe your teaching style, focus areas, or experience."
                />
                <p className="mt-2 text-xs text-slate-400">
                  {about.length}/280 characters
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleProfileSave}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700 transition disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save bio"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Social links
              </h2>
              <p className="text-xs text-slate-500">
                Add links learners can use to connect with you.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Website
                </label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="https://your-site.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  LinkedIn
                </label>
                <input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="https://linkedin.com/in/yourname"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  X (Twitter)
                </label>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="https://x.com/yourname"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleProfileSave}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700 transition disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save links"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Security
              </h2>
              <p className="text-xs text-slate-500">
                Update your password regularly.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Current password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <button
                type="button"
                disabled={changingPassword}
                onClick={handlePasswordChange}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700 transition disabled:opacity-70"
              >
                {changingPassword ? "Updating..." : "Update password"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
