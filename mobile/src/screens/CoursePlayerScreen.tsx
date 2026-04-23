import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import ContentRenderer from "../components/ContentRenderer";
import Quiz from "../components/Quiz";
import ConfettiCannon from "react-native-confetti-cannon"; // Import confetti

const API_BASE_URL = "http://localhost:5000/api";

interface CommentAuthor {
  id: string;
  name: string;
  role: "learner" | "educator";
}

interface CommentThread {
  _id: string;
  blockIndex: number;
  parentId: string | null;
  text: string;
  author: CommentAuthor;
  replies: CommentThread[];
  createdAt: string;
}

interface AdaptiveQuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface AdaptiveQuizPayload {
  mode: "remedial" | "follow-up";
  chapterIndex: number;
  trigger: {
    latestScore: number;
    averageScore: number;
    attempts: number;
  };
  questions: AdaptiveQuizQuestion[];
}

const getLessonDisplayTitle = (block: any, chapterIndex: number) => {
  const title = block?.attrs?.title;
  if (typeof title === "string" && title.trim()) {
    return title.trim();
  }
  return `Chapter ${chapterIndex + 1}`;
};

const formatDateTime = (value?: string) => {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString();
};

const CoursePlayerScreen = ({ route, navigation }: any) => {
  const { courseId } = route.params;
  const [course, setCourse] = useState<any>(null);
  const [progress, setProgress] = useState<any>({
    completedChapters: [],
    quizScores: [],
  });
  const [adaptiveQuiz, setAdaptiveQuiz] = useState<AdaptiveQuizPayload | null>(
    null,
  );
  const [currentChapter, setCurrentChapter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false); // New state
  const [commentThreads, setCommentThreads] = useState<CommentThread[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [activeReplyParentId, setActiveReplyParentId] = useState<string | null>(
    null,
  );
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [postingReplyParentId, setPostingReplyParentId] = useState<string | null>(
    null,
  );
  const { token } = useAuth();

  useEffect(() => {
    fetchCourseAndProgress();
  }, []);

  const fetchCourseAndProgress = async () => {
    try {
      const [courseRes, progressRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/courses/${courseId}`),
        axios.get(`${API_BASE_URL}/progress/${courseId}`, {
          headers: { "x-auth-token": token },
        }),
      ]);
      setCourse(courseRes.data);
      setAdaptiveQuiz(null);

      const completedChapters = Array.isArray(
        progressRes.data?.completedChapters,
      )
        ? progressRes.data.completedChapters
        : [];
      const quizScores = Array.isArray(progressRes.data?.quizScores)
        ? progressRes.data.quizScores
        : [];

      setProgress({
        ...(progressRes.data || {}),
        completedChapters,
        quizScores,
      });

      // Resume from first incomplete chapter
      const completed = completedChapters;
      const firstIncomplete = completed.length;
      setCurrentChapter(
        firstIncomplete < courseRes.data.content.length ? firstIncomplete : 0,
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const moveToNextChapterOrComplete = () => {
    if (currentChapter + 1 < course.content.length) {
      setCurrentChapter((prev) => prev + 1);
      return;
    }

    setShowConfetti(true);
    Alert.alert("Congratulations!", "You have completed the course!");
  };

  const syncProgressFromResponse = (data: any) => {
    setProgress((prev: any) => ({
      ...prev,
      ...(data || {}),
      completedChapters: Array.isArray(data?.completedChapters)
        ? data.completedChapters
        : prev.completedChapters,
      quizScores: Array.isArray(data?.quizScores)
        ? data.quizScores
        : prev.quizScores,
    }));
  };

  const handleChapterComplete = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/progress/${courseId}`,
        {
          chapterIndex: currentChapter,
        },
        {
          headers: { "x-auth-token": token },
        },
      );

      // Update local progress
      setProgress((prev: any) => ({
        ...prev,
        completedChapters: Array.from(
          new Set([...(prev.completedChapters || []), currentChapter]),
        ),
      }));

      moveToNextChapterOrComplete();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save progress");
    }
  };

  const handleQuizComplete = async (score: number) => {
    try {
      const res = await axios.post(
        `${API_BASE_URL}/progress/${courseId}`,
        {
          chapterIndex: currentChapter,
          quizScore: score,
        },
        {
          headers: { "x-auth-token": token },
        },
      );

      syncProgressFromResponse(res.data);

      const adaptiveCandidate = res.data?.adaptiveQuiz;
      const hasAdaptiveQuestions =
        adaptiveCandidate &&
        Array.isArray(adaptiveCandidate.questions) &&
        adaptiveCandidate.questions.length > 0;

      if (hasAdaptiveQuestions) {
        setAdaptiveQuiz(adaptiveCandidate as AdaptiveQuizPayload);
        const modeLabel =
          adaptiveCandidate.mode === "remedial" ? "Remedial" : "Follow-up";
        Alert.alert(
          `${modeLabel} quiz ready`,
          `Your score: ${score.toFixed(0)}%. We've prepared a tailored practice quiz.`,
        );
        return;
      }

      Alert.alert("Quiz completed!", `Your score: ${score.toFixed(0)}%`);
      moveToNextChapterOrComplete();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save quiz score");
    }
  };

  const handleAdaptiveQuizComplete = async (score: number) => {
    if (!adaptiveQuiz) return;
    const adaptiveMode = adaptiveQuiz.mode;

    try {
      const res = await axios.post(
        `${API_BASE_URL}/progress/${courseId}`,
        {
          chapterIndex: currentChapter,
          quizScore: score,
          isAdaptiveAttempt: true,
        },
        {
          headers: { "x-auth-token": token },
        },
      );

      syncProgressFromResponse(res.data);
      setAdaptiveQuiz(null);

      const modeLabel = adaptiveMode === "remedial" ? "Remedial" : "Follow-up";
      Alert.alert(
        `${modeLabel} quiz completed!`,
        `Your score: ${score.toFixed(0)}%`,
      );
      moveToNextChapterOrComplete();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save adaptive quiz score");
    }
  };

  const appendReplyToTree = (
    threads: CommentThread[],
    parentId: string,
    reply: CommentThread,
  ): CommentThread[] => {
    return threads.map((thread) => {
      if (thread._id === parentId) {
        return { ...thread, replies: [...(thread.replies || []), reply] };
      }
      if (!thread.replies?.length) return thread;
      return {
        ...thread,
        replies: appendReplyToTree(thread.replies, parentId, reply),
      };
    });
  };

  const fetchComments = async () => {
    if (!course || !token) return;
    const block = course.content?.[currentChapter];
    if (!block) {
      setCommentThreads([]);
      return;
    }

    setCommentLoading(true);
    setCommentError(null);

    try {
      const res = await axios.get(
        `${API_BASE_URL}/courses/${courseId}/comments`,
        {
          headers: { "x-auth-token": token },
          params: { blockIndex: currentChapter },
        },
      );
      const nextThreads = Array.isArray(res.data?.comments)
        ? (res.data.comments as CommentThread[])
        : [];
      setCommentThreads(nextThreads);
    } catch (err: any) {
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to load comments.";
      setCommentError(message);
      setCommentThreads([]);
    } finally {
      setCommentLoading(false);
    }
  };

  const handlePostComment = async (parentId?: string) => {
    if (!course || !token) return;
    const text = parentId
      ? (replyDrafts[parentId] || "").trim()
      : commentText.trim();
    if (!text) {
      Alert.alert("Comment required", "Please type your message first.");
      return;
    }

    if (parentId) {
      setPostingReplyParentId(parentId);
    } else {
      setPostingComment(true);
    }

    try {
      const res = await axios.post(
        `${API_BASE_URL}/courses/${courseId}/comments`,
        {
          blockIndex: currentChapter,
          text,
          ...(parentId ? { parentId } : {}),
        },
        {
          headers: { "x-auth-token": token },
        },
      );
      const createdComment = res.data?.comment as CommentThread | undefined;
      if (createdComment?._id) {
        if (createdComment.parentId) {
          setCommentThreads((prev) =>
            appendReplyToTree(prev, createdComment.parentId!, createdComment),
          );
        } else {
          setCommentThreads((prev) => [...prev, createdComment]);
        }
      }

      if (parentId) {
        setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
        setActiveReplyParentId(null);
      } else {
        setCommentText("");
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to post comment.";
      Alert.alert("Unable to post", message);
    } finally {
      if (parentId) {
        setPostingReplyParentId(null);
      } else {
        setPostingComment(false);
      }
    }
  };

  useEffect(() => {
    fetchComments();
  }, [course, currentChapter, token]);

  if (loading)
    return (
      <View style={styles.container}>
        <Text>Loading course...</Text>
      </View>
    );
  if (!course)
    return (
      <View style={styles.container}>
        <Text>Course not found</Text>
      </View>
    );

  const block = course.content[currentChapter];
  const lessonTitle = getLessonDisplayTitle(block, currentChapter);
  const canComment = Boolean(token);
  const isAdaptiveQuizActive =
    block?.type === "quiz" &&
    adaptiveQuiz?.chapterIndex === currentChapter &&
    Array.isArray(adaptiveQuiz?.questions) &&
    adaptiveQuiz.questions.length > 0;
  const activeQuizQuestions = isAdaptiveQuizActive
    ? adaptiveQuiz?.questions || []
    : block?.attrs?.questions || [];

  const renderCommentThread = (thread: CommentThread, depth = 0): React.ReactNode => {
    const isReplying = activeReplyParentId === thread._id;
    return (
      <View
        key={thread._id}
        style={[styles.threadCard, depth > 0 ? styles.threadReplyDepth : null]}
      >
        <Text style={styles.threadMeta}>
          {thread.author?.name || "User"} • {formatDateTime(thread.createdAt)}
        </Text>
        <Text style={styles.threadQuestion}>{thread.text}</Text>

        <TouchableOpacity
          onPress={() =>
            setActiveReplyParentId((prev) =>
              prev === thread._id ? null : thread._id,
            )
          }
        >
          <Text style={styles.replyAction}>
            {isReplying ? "Cancel" : "Reply"}
          </Text>
        </TouchableOpacity>

        {isReplying && (
          <View style={styles.askContainer}>
            <TextInput
              value={replyDrafts[thread._id] || ""}
              onChangeText={(value) =>
                setReplyDrafts((prev) => ({ ...prev, [thread._id]: value }))
              }
              placeholder="Write a reply..."
              multiline
              style={styles.askInput}
            />
            <TouchableOpacity
              onPress={() => handlePostComment(thread._id)}
              disabled={postingReplyParentId === thread._id}
              style={[
                styles.askButton,
                postingReplyParentId === thread._id
                  ? styles.askButtonDisabled
                  : null,
              ]}
            >
              <Text style={styles.askButtonText}>
                {postingReplyParentId === thread._id ? "Posting..." : "Post reply"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {(thread.replies || []).map((reply) => renderCommentThread(reply, depth + 1))}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.chapterIndicator}>
        Chapter {currentChapter + 1} of {course.content.length}
      </Text>
      {block.type === "quiz" ? (
        activeQuizQuestions.length > 0 ? (
          <>
            {isAdaptiveQuizActive && (
              <View style={styles.adaptiveBanner}>
                <Text style={styles.adaptiveBannerTitle}>
                  {adaptiveQuiz?.mode === "remedial"
                    ? "Remedial Practice"
                    : "Follow-up Practice"}
                </Text>
                <Text style={styles.adaptiveBannerText}>
                  These AI-generated questions are tailored to your quiz scores.
                </Text>
              </View>
            )}
            <Quiz
              questions={activeQuizQuestions}
              onComplete={
                isAdaptiveQuizActive ? handleAdaptiveQuizComplete : handleQuizComplete
              }
            />
          </>
        ) : (
          <View style={styles.buttonContainer}>
            <Text style={styles.emptyText}>
              No quiz questions available for this chapter.
            </Text>
            <Button title="Continue" onPress={moveToNextChapterOrComplete} />
          </View>
        )
      ) : (
        <>
          <ContentRenderer blocks={[block]} />
          <View style={styles.buttonContainer}>
            <Button title="Mark as Completed" onPress={handleChapterComplete} />
          </View>
        </>
      )}

      <View style={styles.discussionSection}>
        <Text style={styles.discussionTitle}>Comments for {lessonTitle}</Text>
        <Text style={styles.discussionSubtitle}>
          Discuss this lesson with threaded comments.
        </Text>

        {canComment && (
          <View style={styles.askContainer}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write a comment about this lesson..."
              multiline
              style={styles.askInput}
            />
            <TouchableOpacity
              onPress={() => handlePostComment()}
              disabled={postingComment}
              style={[
                styles.askButton,
                postingComment ? styles.askButtonDisabled : null,
              ]}
            >
              <Text style={styles.askButtonText}>
                {postingComment ? "Posting..." : "Post comment"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {commentLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#0f766e" />
            <Text style={styles.loadingText}>Loading comments...</Text>
          </View>
        )}

        {!commentLoading && commentError ? (
          <Text style={styles.errorText}>{commentError}</Text>
        ) : null}

        {!commentLoading && !commentError && commentThreads.length === 0 && (
          <Text style={styles.emptyText}>No comments yet. Start the discussion.</Text>
        )}

        {!commentLoading &&
          !commentError &&
          commentThreads.map((thread) => renderCommentThread(thread))}
      </View>

      {/* Confetti animation */}
      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: -10, y: -10 }}
          autoStart={true}
          fadeOut={true}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  chapterIndicator: { fontSize: 16, color: "#666", marginBottom: 16 },
  buttonContainer: { marginVertical: 20, alignItems: "center" },
  adaptiveBanner: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#99f6e4",
    backgroundColor: "#ecfeff",
  },
  adaptiveBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#115e59",
  },
  adaptiveBannerText: {
    marginTop: 4,
    fontSize: 12,
    color: "#0f766e",
  },
  discussionSection: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    marginBottom: 24,
  },
  discussionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  discussionSubtitle: {
    marginTop: 6,
    color: "#475569",
    fontSize: 13,
    marginBottom: 12,
  },
  askContainer: {
    marginBottom: 12,
  },
  askInput: {
    minHeight: 82,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 10,
    textAlignVertical: "top",
    backgroundColor: "#fff",
  },
  askButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "#0f766e",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  askButtonDisabled: {
    opacity: 0.6,
  },
  askButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  loadingText: {
    color: "#475569",
    fontSize: 13,
    marginLeft: 8,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
  },
  emptyText: {
    color: "#64748b",
    fontSize: 13,
  },
  threadCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#fff",
    marginTop: 10,
  },
  threadMeta: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
  },
  threadQuestion: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },
  threadReplyDepth: {
    marginLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#cbd5e1",
  },
  replyAction: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#0f766e",
  },
});

export default CoursePlayerScreen;
