import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const Profile: React.FC = () => {
  const { user, token, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [walletAddress, setWalletAddress] = useState(
    user?.walletAddress || "",
  );
  const [about, setAbout] = useState(user?.about || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [linkedin, setLinkedin] = useState(user?.linkedin || "");
  const [twitter, setTwitter] = useState(user?.twitter || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setName(user?.name || "");
    setWalletAddress(user?.walletAddress || "");
    setAbout(user?.about || "");
    setWebsite(user?.website || "");
    setLinkedin(user?.linkedin || "");
    setTwitter(user?.twitter || "");
  }, [user]);

  const handleProfileSave = async () => {
    setStatus("");
    setSaving(true);
    try {
      await api.put(
        "/users/me",
        { name, walletAddress, about, website, linkedin, twitter },
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
            <h1 className="text-3xl font-semibold text-slate-900 mt-2">
              Profile settings
            </h1>
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
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Wallet address
                </label>
                <input
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Solana wallet address"
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
