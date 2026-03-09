import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import ContentRenderer from "../components/ContentRenderer";
import Quiz from "../components/Quiz";

const CoursePlayerScreen = ({ route, navigation }: any) => {
  const { courseId } = route.params;
  const [course, setCourse] = useState<any>(null);
  const [progress, setProgress] = useState<any>({
    completedChapters: [],
    quizScores: {},
  });
  const [currentChapter, setCurrentChapter] = useState(0);
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
      // Move to next chapter if available
      if (currentChapter + 1 < course.content.length) {
        setCurrentChapter((prev) => prev + 1);
      } else {
        Alert.alert("Congratulations!", "You have completed the course!");
        // Optionally navigate to certificate/NFT screen
      }
    } catch (err) {
      console.error(err);
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
      // Move to next chapter
      if (currentChapter + 1 < course.content.length) {
        setCurrentChapter((prev) => prev + 1);
      } else {
        Alert.alert("Congratulations!", "You have completed the course!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!course)
    return (
      <View>
        <Text>Loading...</Text>
      </View>
    );

  const block = course.content[currentChapter];

  return (
    <View style={styles.container}>
      <Text style={styles.chapterIndicator}>
        Chapter {currentChapter + 1} of {course.content.length}
      </Text>
      {block.type === "quiz" ? (
        <Quiz
          questions={block.data?.questions || []}
          onComplete={handleQuizComplete}
        />
      ) : (
        <>
          <ContentRenderer blocks={[block]} />
          <Button title="Mark as Completed" onPress={handleChapterComplete} />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  chapterIndicator: { fontSize: 16, color: "#666", marginBottom: 16 },
});

export default CoursePlayerScreen;
