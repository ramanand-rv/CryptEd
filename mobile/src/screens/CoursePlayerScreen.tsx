import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Video, ResizeMode } from "expo-av";
import RenderHtml from "react-native-render-html";
import { useWindowDimensions } from "react-native";
import QuizComponent from "../components/QuizComponent";

interface Block {
  type: string;
  attrs?: any;
  content?: any[];
  text?: string;
  // For video
  src?: string;
  // For quiz
  questions?: any[];
}

const CoursePlayerScreen = ({ route, navigation }: any) => {
  const { courseId } = route.params;
  const [course, setCourse] = useState<any>(null);
  const [progress, setProgress] = useState<any>({
    completedChapters: [],
    quizScores: [],
  });
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    fetchCourseAndProgress();
  }, []);

  const fetchCourseAndProgress = async () => {
    try {
      const [courseRes, progressRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/courses/${courseId}`),
        axios.get(`http://localhost:5000/api/progress/${courseId}`, {
          headers: { "x-auth-token": token },
        }),
      ]);
      setCourse(courseRes.data);
      setProgress(progressRes.data);
      // Find first incomplete chapter
      const completed = progressRes.data.completedChapters || [];
      const firstIncomplete = courseRes.data.content.findIndex(
        (_: any, idx: number) => !completed.includes(idx),
      );
      setCurrentBlockIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load course");
    } finally {
      setLoading(false);
    }
  };

  const markChapterCompleted = async () => {
    const newCompleted = [
      ...(progress.completedChapters || []),
      currentBlockIndex,
    ];
    try {
      const res = await axios.post(
        `http://localhost:5000/api/progress/${courseId}`,
        { completedChapters: newCompleted },
        { headers: { "x-auth-token": token } },
      );
      setProgress(res.data);
      // Move to next incomplete chapter
      const nextIncomplete = course.content.findIndex(
        (_: any, idx: number) => !res.data.completedChapters.includes(idx),
      );
      if (nextIncomplete >= 0) {
        setCurrentBlockIndex(nextIncomplete);
      } else {
        // Course completed!
        Alert.alert(
          "Congratulations!",
          "You have completed the course. You will receive an NFT soon.",
        );
        navigation.goBack();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuizComplete = async (score: number, passed: boolean) => {
    if (passed) {
      // Record quiz result and mark chapter completed
      try {
        const res = await axios.post(
          `http://localhost:5000/api/progress/${courseId}`,
          {
            quizResult: { blockIndex: currentBlockIndex, score, passed },
            completedChapters: [
              ...(progress.completedChapters || []),
              currentBlockIndex,
            ],
          },
          { headers: { "x-auth-token": token } },
        );
        setProgress(res.data);
        // Move to next chapter
        const nextIncomplete = course.content.findIndex(
          (_: any, idx: number) => !res.data.completedChapters.includes(idx),
        );
        if (nextIncomplete >= 0) {
          setCurrentBlockIndex(nextIncomplete);
        } else {
          Alert.alert(
            "Congratulations!",
            "You have completed the course. You will receive an NFT soon.",
          );
          navigation.goBack();
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      Alert.alert(
        "Try Again",
        "You did not pass the quiz. Review the material and try again.",
      );
    }
  };

  const renderBlock = (block: Block, index: number) => {
    const isCompleted = progress.completedChapters?.includes(index);
    const isCurrent = index === currentBlockIndex;

    // If not current and not completed, maybe show as locked (optional)
    if (!isCurrent && !isCompleted) {
      return (
        <View key={index} style={styles.lockedBlock}>
          <Text style={styles.lockedText}>
            🔒 Complete previous chapter to unlock
          </Text>
        </View>
      );
    }

    switch (block.type) {
      case "heading":
        return (
          <Text
            key={index}
            style={[
              styles.heading,
              {
                fontSize: block.attrs?.level ? 24 - block.attrs.level * 2 : 20,
              },
            ]}
          >
            {block.content?.[0]?.text}
          </Text>
        );
      case "paragraph":
        return (
          <View key={index} style={styles.paragraph}>
            <RenderHtml
              contentWidth={width - 32}
              source={{ html: `<p>${block.content?.[0]?.text || ""}</p>` }}
            />
          </View>
        );
      case "video":
        return (
          <View key={index} style={styles.videoContainer}>
            <Video
              ref={videoRef}
              source={{ uri: block.src || block.attrs?.src }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isCurrent}
            />
          </View>
        );
      case "quiz":
        return (
          <View key={index} style={styles.quizContainer}>
            <QuizComponent
              questions={block.questions || []}
              onComplete={(score, passed) => handleQuizComplete(score, passed)}
            />
          </View>
        );
      default:
        return (
          <Text key={index} style={styles.paragraph}>
            Unsupported block type: {block.type}
          </Text>
        );
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const currentBlock = course.content[currentBlockIndex];
  const isLastBlock = currentBlockIndex === course.content.length - 1;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {course.content.map((block: Block, index: number) => (
          <View key={index}>
            {renderBlock(block, index)}
            {index === currentBlockIndex && block.type !== "quiz" && (
              <TouchableOpacity
                style={styles.completeButton}
                onPress={markChapterCompleted}
              >
                <Text style={styles.completeButtonText}>
                  {isLastBlock ? "Complete Course" : "Mark as Completed"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16 },
  heading: { fontWeight: "bold", marginVertical: 8 },
  paragraph: { marginVertical: 8 },
  videoContainer: { height: 200, marginVertical: 16 },
  video: { flex: 1 },
  quizContainer: { marginVertical: 16 },
  lockedBlock: {
    padding: 16,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    marginVertical: 8,
    alignItems: "center",
  },
  lockedText: { color: "#999", fontStyle: "italic" },
  completeButton: {
    backgroundColor: "#2ecc71",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 16,
  },
  completeButtonText: { color: "white", fontWeight: "bold" },
});

export default CoursePlayerScreen;
