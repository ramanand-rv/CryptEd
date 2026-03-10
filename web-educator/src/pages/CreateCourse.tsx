import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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
      price: price * 1e9, // convert SOL to lamports (assuming UI shows SOL)
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

      // Append the quiz block to the content
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
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create New Course</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded p-2"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded p-2"
            rows={3}
            required
          />
        </div>
        <div>
          <label className="block mb-1">Price (SOL)</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(parseFloat(e.target.value))}
            className="w-full border rounded p-2"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Course Content</label>
          <button
            type="button"
            onClick={handleGenerateQuiz}
            className="mb-2 bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700"
          >
            Generate Quiz with AI
          </button>
          <Editor content={content} onChange={setContent} />
        </div>
        <div>
          <label className="block mb-1">NFT Metadata URI (optional)</label>
          <input
            type="url"
            value={nftMetadataUri}
            onChange={(e) => setNftMetadataUri(e.target.value)}
            className="w-full border rounded p-2"
            placeholder="ipfs://..."
          />
        </div>
        <div className="border-t pt-4">
          <h2 className="text-lg font-semibold mb-2">Reward Pool (optional)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Total SOL to distribute</label>
              <input
                type="number"
                step="0.01"
                value={rewardPoolAmount}
                onChange={(e) =>
                  setRewardPoolAmount(parseFloat(e.target.value))
                }
                className="w-full border rounded p-2"
              />
            </div>
            <div>
              <label className="block mb-1">Number of winners</label>
              <input
                type="number"
                value={rewardWinners}
                onChange={(e) => setRewardWinners(parseInt(e.target.value))}
                className="w-full border rounded p-2"
                min="1"
              />
            </div>
          </div>
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create Course
        </button>
      </form>
    </div>
  );
};

export default CreateCourse;
