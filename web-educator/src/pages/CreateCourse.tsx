import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import Editor from "../components/Editor";
import type { JSONContent } from "@tiptap/react";

const CreateCourse: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [content, setContent] = useState<JSONContent>({
    type: "doc",
    content: [{ type: "paragraph" }],
  });
  const [nftMetadataUri, setNftMetadataUri] = useState("");
  const [rewardPoolAmount, setRewardPoolAmount] = useState<number>(0);
  const [rewardWinners, setRewardWinners] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const courseData = {
      title,
      description,
      price: price * 1e9,
      content,
      nftMetadataUri: nftMetadataUri || undefined,
      rewardPool:
        rewardPoolAmount > 0
          ? {
              totalAmount: rewardPoolAmount * 1e9,
              winnersCount: rewardWinners,
            }
          : undefined,
    };

    try {
      await axios.post("http://localhost:5000/api/courses", courseData, {
        headers: { "x-auth-token": token },
      });
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to create course. Please check the console for details.");
    }
  };

  const handleGenerateQuiz = async () => {
    if (!title || !description) {
      alert("Please enter a title and description first");
      return;
    }

    try {
      const res = await axios.post(
        "http://localhost:5000/api/courses/generate-quiz",
        { title, description, numQuestions: 5 },
        { headers: { "x-auth-token": token } },
      );

      const quizBlock = {
        type: "quiz",
        attrs: { questions: res.data.questions },
      };

      setContent((prev) => ({
        ...prev,
        content: [...(prev.content || []), quizBlock],
      }));

      alert("Quiz block added to the end of the content!");
    } catch (err) {
      console.error(err);
      alert("Failed to generate quiz. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 mb-6 inline-block">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Create a New Course</h1>
        
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-lg space-y-8">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-lg font-semibold text-gray-700 mb-2">Title</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-lg"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-lg font-semibold text-gray-700 mb-2">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-lg"
                rows={4}
                required
              />
            </div>
            <div>
              <label htmlFor="price" className="block text-lg font-semibold text-gray-700 mb-2">Price (SOL)</label>
              <input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                className="w-full border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-lg"
                required
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <label className="block text-xl font-bold text-gray-800 mb-4">Course Content</label>
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={handleGenerateQuiz}
                className="bg-purple-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-purple-700 transition-colors"
              >
                Generate Quiz with AI ✨
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-1">
             <Editor content={content} onChange={setContent} />
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-8">
             <h2 className="text-xl font-bold text-gray-800 mb-4">NFT & Rewards (Optional)</h2>
             <div className="space-y-6">
                <div>
                  <label htmlFor="nft-uri" className="block text-lg font-semibold text-gray-700 mb-2">NFT Metadata URI</label>
                  <input
                    id="nft-uri"
                    type="url"
                    value={nftMetadataUri}
                    onChange={(e) => setNftMetadataUri(e.target.value)}
                    className="w-full border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    placeholder="ipfs://..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="reward-pool" className="block text-lg font-semibold text-gray-700 mb-2">Total Reward (SOL)</label>
                    <input
                      id="reward-pool"
                      type="number"
                      step="0.01"
                      value={rewardPoolAmount}
                      onChange={(e) => setRewardPoolAmount(parseFloat(e.target.value))}
                      className="w-full border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="reward-winners" className="block text-lg font-semibold text-gray-700 mb-2">Number of Winners</label>
                    <input
                      id="reward-winners"
                      type="number"
                      value={rewardWinners}
                      onChange={(e) => setRewardWinners(parseInt(e.target.value))}
                      className="w-full border-gray-300 rounded-md shadow-sm p-3 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      min="1"
                    />
                  </div>
                </div>
             </div>
          </div>

          <div className="pt-8 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white text-lg font-semibold px-8 py-4 rounded-md shadow-lg hover:bg-blue-700 transition-transform transform hover:scale-105"
            >
              Create Course
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCourse;
