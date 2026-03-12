import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import ContentRenderer from "../components/ContentRenderer";
import Quiz from "../components/Quiz";
import ConfettiCannon from "react-native-confetti-cannon"; // <-- Import confetti

const CoursePlayerScreen = ({ route, navigation }: any) => {
  const { courseId } = route.params;
  const [course, setCourse] = useState<any>(null);
  const [progress, setProgress] = useState<any>({
    completedChapters: [],
    quizScores: {},
  });
  const [currentChapter, setCurrentChapter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false); // <-- New state
  const { token } = useAuth();

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

      // Resume from first incomplete chapter
      const completed = progressRes.data.completedChapters || [];
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

  const handleChapterComplete = async () => {
    try {
      await axios.post(
        `http://localhost:5000/api/progress/${courseId}`,
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
        completedChapters: [...prev.completedChapters, currentChapter],
      }));

      // Move to next chapter if available
      if (currentChapter + 1 < course.content.length) {
        setCurrentChapter((prev) => prev + 1);
      } else {
        // Course completed!
        setShowConfetti(true); // <-- Trigger confetti
        Alert.alert("Congratulations!", "You have completed the course!");
        // Optional: navigate back to course list after a delay
        // setTimeout(() => navigation.goBack(), 3000);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save progress");
    }
  };

  const handleQuizComplete = async (score: number) => {
    try {
      await axios.post(
        `http://localhost:5000/api/progress/${courseId}`,
        {
          chapterIndex: currentChapter,
          quizScore: score,
        },
        {
          headers: { "x-auth-token": token },
        },
      );

      Alert.alert("Quiz completed!", `Your score: ${score.toFixed(0)}%`);

      // Update local progress
      setProgress((prev: any) => ({
        ...prev,
        completedChapters: [...prev.completedChapters, currentChapter],
        quizScores: { ...prev.quizScores, [currentChapter]: score },
      }));

      // Move to next chapter
      if (currentChapter + 1 < course.content.length) {
        setCurrentChapter((prev) => prev + 1);
      } else {
        // Course completed!
        setShowConfetti(true); // <-- Trigger confetti
        Alert.alert("Congratulations!", "You have completed the course!");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save quiz score");
    }
  };

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

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.chapterIndicator}>
        Chapter {currentChapter + 1} of {course.content.length}
      </Text>
      {block.type === "quiz" ? (
        <Quiz
          questions={block.attrs?.questions || []}
          onComplete={handleQuizComplete}
        />
      ) : (
        <>
          <ContentRenderer blocks={[block]} />
          <View style={styles.buttonContainer}>
            <Button title="Mark as Completed" onPress={handleChapterComplete} />
          </View>
        </>
      )}

      {/* Confetti animation */}
      {showConfetti && (
        <ConfettiCannon
          count={200}
          origin={{ x: -10, y: 0 }}
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
});

export default CoursePlayerScreen;
