import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const CreateCourse: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [nftMetadataUri, setNftMetadataUri] = useState("");
  const [rewardPoolAmount, setRewardPoolAmount] = useState<number>(0);
  const [rewardWinners, setRewardWinners] = useState<number>(0);
  const [submitting, setSubmitting] = useState<"draft" | "published" | null>(
    null,
  );
  const rewardsLocked = !user?.walletVerifiedAt;

  const handleCreate = async (status: "draft" | "published") => {
    setSubmitting(status);

    const courseData = {
      title,
      description,
      price: price * 1e9,
      content: [],
      status,
      nftMetadataUri: rewardsLocked ? undefined : nftMetadataUri || undefined,
      rewardPool:
        !rewardsLocked && rewardPoolAmount > 0
          ? {
              totalAmount: rewardPoolAmount * 1e9,
              winnersCount: Math.max(1, rewardWinners || 1),
            }
          : undefined,
    };

    try {
      const res = await api.post("/courses", courseData, {
        headers: { "x-auth-token": token },
      });
      const courseId = res.data?._id;
      if (courseId) {
        navigate(`/courses/${courseId}/contents`);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to create course. Please check the console for details.");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link
              to="/dashboard"
              className="text-xs uppercase text-emerald-600"
            >
              Back to dashboard
            </Link>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 mt-2">
              Create a new course
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl">
              Start with the essentials. You will add lessons and content after
              creating the course.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              form="create-course"
              value="draft"
              disabled={submitting !== null}
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 transition disabled:opacity-70"
            >
              {submitting === "draft" ? "Saving..." : "Save draft"}
            </button>
            <button
              type="submit"
              form="create-course"
              value="published"
              disabled={submitting !== null}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-70"
            >
              {submitting === "published" ? "Publishing..." : "Publish course"}
            </button>
          </div>
        </div>

        <form
          id="create-course"
          onSubmit={(event) => {
            event.preventDefault();
            const submitter = (event.nativeEvent as SubmitEvent)
              .submitter as HTMLButtonElement | null;
            const intent =
              submitter?.value === "published" ? "published" : "draft";
            handleCreate(intent);
          }}
          className="grid lg:grid-cols-[0.9fr] gap-8 items-start"
        >
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-slate-900">
                Course essentials
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Keep it clear and enticing. You can refine details later.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="Build your first crypto portfolio"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    rows={5}
                    placeholder="What will learners achieve after this course?"
                    required
                  />
                </div>
                <div>
                  <label
                    htmlFor="price"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Price (SOL)
                  </label>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value))}
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-soft">
              <h2 className="text-lg font-semibold text-slate-900">
                NFT & rewards
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Optional, but delightful. Reward learners for completion.
              </p>
              {rewardsLocked && (
                <p className="mt-3 text-xs text-amber-600">
                  Verify your wallet in Profile settings to enable rewards and
                  NFT minting.
                </p>
              )}
              <div className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="nft-uri"
                    className="block text-sm font-medium text-slate-700"
                  >
                    NFT metadata URI
                  </label>
                  <input
                    id="nft-uri"
                    type="url"
                    value={nftMetadataUri}
                    onChange={(e) => setNftMetadataUri(e.target.value)}
                    className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="ipfs://..."
                    disabled={rewardsLocked}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reward-pool"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Total reward (SOL)
                    </label>
                    <input
                      id="reward-pool"
                      type="number"
                      step="0.01"
                      value={rewardPoolAmount}
                      onChange={(e) =>
                        setRewardPoolAmount(parseFloat(e.target.value))
                      }
                      className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      disabled={rewardsLocked}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reward-winners"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Number of winners
                    </label>
                    <input
                      id="reward-winners"
                      type="number"
                      value={rewardWinners}
                      onChange={(e) =>
                        setRewardWinners(parseInt(e.target.value))
                      }
                      className="w-full mt-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      min="1"
                      disabled={rewardsLocked}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCourse;
