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

interface DiscussionAuthor {
  id: string;
  name: string;
  role: "learner" | "educator";
}

interface DiscussionReply {
  _id: string;
  message: string;
  author: DiscussionAuthor;
  createdAt: string;
}

interface DiscussionThread {
  _id: string;
  lessonId: string;
  question: string;
  askedBy: DiscussionAuthor;
  replies: DiscussionReply[];
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

const getLessonDiscussionId = (block: any, chapterIndex: number) => {
  const nestedLessonId = block?.attrs?.lessonId;
  if (block?.type === "lesson" && typeof nestedLessonId === "string") {
    const trimmed = nestedLessonId.trim();
    if (trimmed) return trimmed;
  }
  return `chapter-${chapterIndex}`;
};

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
  const [discussionThreads, setDiscussionThreads] = useState<DiscussionThread[]>(
    [],
  );
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [discussionError, setDiscussionError] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [postingQuestion, setPostingQuestion] = useState(false);
  const { token, user } = useAuth();

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

  const fetchLessonDiscussions = async () => {
    if (!course || !token) return;
    const block = course.content?.[currentChapter];
    if (!block) {
      setDiscussionThreads([]);
      return;
    }

    const lessonId = getLessonDiscussionId(block, currentChapter);
    setDiscussionLoading(true);
    setDiscussionError(null);

    try {
      const res = await axios.get(
        `${API_BASE_URL}/courses/${courseId}/lessons/${encodeURIComponent(lessonId)}/discussions`,
        {
          headers: { "x-auth-token": token },
        },
      );
      const nextThreads = Array.isArray(res.data?.discussions)
        ? (res.data.discussions as DiscussionThread[])
        : [];
      setDiscussionThreads(nextThreads);
    } catch (err: any) {
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to load lesson discussion.";
      setDiscussionError(message);
      setDiscussionThreads([]);
    } finally {
      setDiscussionLoading(false);
    }
  };

  const handlePostQuestion = async () => {
    if (!course || !token) return;
    const question = questionText.trim();
    if (!question) {
      Alert.alert("Question required", "Please type your question first.");
      return;
    }

    const block = course.content?.[currentChapter];
    const lessonId = getLessonDiscussionId(block, currentChapter);
    setPostingQuestion(true);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/courses/${courseId}/lessons/${encodeURIComponent(lessonId)}/discussions`,
        { question },
        {
          headers: { "x-auth-token": token },
        },
      );
      const newDiscussion = res.data?.discussion as DiscussionThread | undefined;
      if (newDiscussion?._id) {
        setDiscussionThreads((prev) => [newDiscussion, ...prev]);
      }
      setQuestionText("");
    } catch (err: any) {
      const message =
        err?.response?.data?.msg ||
        err?.response?.data?.error ||
        "Failed to post question.";
      Alert.alert("Unable to post", message);
    } finally {
      setPostingQuestion(false);
    }
  };

  useEffect(() => {
    fetchLessonDiscussions();
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
  const canAskQuestion = user?.role === "learner";
  const isAdaptiveQuizActive =
    block?.type === "quiz" &&
    adaptiveQuiz?.chapterIndex === currentChapter &&
    Array.isArray(adaptiveQuiz?.questions) &&
    adaptiveQuiz.questions.length > 0;
  const activeQuizQuestions = isAdaptiveQuizActive
    ? adaptiveQuiz?.questions || []
    : block?.attrs?.questions || [];

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
        <Text style={styles.discussionTitle}>Q&A for {lessonTitle}</Text>
        <Text style={styles.discussionSubtitle}>
          Ask questions in-context. Educators can reply in-thread.
        </Text>

        {canAskQuestion && (
          <View style={styles.askContainer}>
            <TextInput
              value={questionText}
              onChangeText={setQuestionText}
              placeholder="Ask a question about this lesson..."
              multiline
              style={styles.askInput}
            />
            <TouchableOpacity
              onPress={handlePostQuestion}
              disabled={postingQuestion}
              style={[
                styles.askButton,
                postingQuestion ? styles.askButtonDisabled : null,
              ]}
            >
              <Text style={styles.askButtonText}>
                {postingQuestion ? "Posting..." : "Post question"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {discussionLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#0f766e" />
            <Text style={styles.loadingText}>Loading discussion...</Text>
          </View>
        )}

        {!discussionLoading && discussionError ? (
          <Text style={styles.errorText}>{discussionError}</Text>
        ) : null}

        {!discussionLoading &&
          !discussionError &&
          discussionThreads.length === 0 && (
            <Text style={styles.emptyText}>
              No questions yet. Start the discussion.
            </Text>
          )}

        {!discussionLoading &&
          !discussionError &&
          discussionThreads.map((thread) => (
            <View key={thread._id} style={styles.threadCard}>
              <Text style={styles.threadMeta}>
                {thread.askedBy?.name || "Learner"} •{" "}
                {formatDateTime(thread.createdAt)}
              </Text>
              <Text style={styles.threadQuestion}>{thread.question}</Text>

              {thread.replies.length === 0 ? (
                <Text style={styles.noReplyText}>No educator reply yet.</Text>
              ) : (
                thread.replies.map((reply) => (
                  <View key={reply._id} style={styles.replyCard}>
                    <Text style={styles.replyMeta}>
                      {reply.author?.name || "Educator"} •{" "}
                      {formatDateTime(reply.createdAt)}
                    </Text>
                    <Text style={styles.replyText}>{reply.message}</Text>
                  </View>
                ))
              )}
            </View>
          ))}
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
  noReplyText: {
    marginTop: 8,
    fontSize: 12,
    color: "#94a3b8",
  },
  replyCard: {
    marginTop: 8,
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftColor: "#cbd5e1",
    borderLeftWidth: 2,
  },
  replyMeta: {
    fontSize: 12,
    color: "#0f766e",
    marginBottom: 3,
  },
  replyText: {
    fontSize: 13,
    color: "#334155",
  },
});

export default CoursePlayerScreen;
