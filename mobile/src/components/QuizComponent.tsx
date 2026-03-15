import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option
}

interface QuizComponentProps {
  questions: Question[];
  onComplete: (score: number, passed: boolean) => void;
}

const QuizComponent: React.FC<QuizComponentProps> = ({
  questions,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = questions[currentIndex];

  const handleOptionPress = (index: number) => {
    setSelectedOption(index);
  };

  const handleNext = () => {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === currentQuestion.correctAnswer;
    const newScore = isCorrect ? score + 1 : score;

    if (currentIndex < questions.length - 1) {
      setScore(newScore);
      setSelectedOption(null);
      setCurrentIndex(currentIndex + 1);
    } else {
      // Quiz finished
      const finalScore = newScore;
      const passed = finalScore >= questions.length * 0.7; // 70% to pass
      setScore(finalScore);
      setShowResult(true);
      onComplete(finalScore, passed);
    }
  };

  if (showResult) {
    const passed = score >= questions.length * 0.7;
    return (
      <View style={styles.resultContainer}>
        <Text style={styles.resultText}>
          Your score: {score}/{questions.length}
        </Text>
        <Text
          style={[styles.resultText, passed ? styles.passed : styles.failed]}
        >
          {passed ? "✅ Passed!" : "❌ Failed. Try again."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.question}>
        Question {currentIndex + 1}/{questions.length}:{" "}
        {currentQuestion.question}
      </Text>
      {currentQuestion.options.map((option, idx) => (
        <TouchableOpacity
          key={idx}
          style={[
            styles.option,
            selectedOption === idx && styles.selectedOption,
          ]}
          onPress={() => handleOptionPress(idx)}
        >
          <Text style={styles.optionText}>{option}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[
          styles.nextButton,
          selectedOption === null && styles.disabledButton,
        ]}
        onPress={handleNext}
        disabled={selectedOption === null}
      >
        <Text style={styles.nextButtonText}>
          {currentIndex < questions.length - 1 ? "Next" : "Finish"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f9f9f9", borderRadius: 8 },
  question: { fontSize: 16, fontWeight: "bold", marginBottom: 16 },
  option: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  selectedOption: { backgroundColor: "#e3f2fd", borderColor: "#2196f3" },
  optionText: { fontSize: 14 },
  nextButton: {
    backgroundColor: "#2196f3",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  disabledButton: { backgroundColor: "#ccc" },
  nextButtonText: { color: "white", fontWeight: "bold" },
  resultContainer: { padding: 16, alignItems: "center" },
  resultText: { fontSize: 18, marginBottom: 8 },
  passed: { color: "#2ecc71" },
  failed: { color: "#e74c3c" },
});

export default QuizComponent;
