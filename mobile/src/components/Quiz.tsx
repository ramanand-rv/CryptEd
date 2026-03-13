import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import LottieView from "lottie-react-native";

interface Question {
  question: string;
  options: string[];
  correct: number; // index of correct option (0-based)
}

interface QuizProps {
  questions: Question[];
  onComplete: (score: number) => void;
}

const Quiz: React.FC<QuizProps> = ({ questions, onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showIncorrect, setShowIncorrect] = useState(false);

  const handleOptionPress = (index: number) => {
    setSelectedOption(index);
    const isCorrect = index === questions[currentIndex].correct;
    if (isCorrect) {
      setShowCorrect(true);
      setTimeout(() => setShowCorrect(false), 1000);
    } else {
      setShowIncorrect(true);
      setTimeout(() => setShowIncorrect(false), 1000);
    }
  };

  const handleNext = () => {
    if (selectedOption === null) {
      Alert.alert("Please select an option");
      return;
    }

    const isCorrect = selectedOption === questions[currentIndex].correct;
    if (isCorrect) setScore((prev) => prev + 1);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      // Quiz finished
      const finalScore =
        ((score + (isCorrect ? 1 : 0)) / questions.length) * 100;
      onComplete(finalScore);
      setShowResult(true);
    }
  };

  if (showResult) {
    const percentage = (score / questions.length) * 100;
    return (
      <View style={styles.container}>
        <Text style={styles.resultText}>Quiz Completed!</Text>
        <Text style={styles.scoreText}>
          Score: {score}/{questions.length} ({percentage.toFixed(0)}%)
        </Text>
      </View>
    );
  }

  const q = questions[currentIndex];
  return (
    <View style={styles.container}>
      <Text style={styles.question}>
        Question {currentIndex + 1}/{questions.length}: {q.question}
      </Text>
      {q.options.map((opt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[
            styles.option,
            selectedOption === idx && styles.selectedOption,
          ]}
          onPress={() => handleOptionPress(idx)}
        >
          <Text style={styles.optionText}>{opt}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>
          {currentIndex + 1 === questions.length ? "Finish" : "Next"}
        </Text>
      </TouchableOpacity>

      {/* Lottie animations */}
      {showCorrect && (
        <LottieView
          source={require("../../assets/correct.json")}
          autoPlay
          loop={false}
          style={styles.animation}
        />
      )}
      {showIncorrect && (
        <LottieView
          source={require("../../assets/incorrect.json")}
          autoPlay
          loop={false}
          style={styles.animation}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1 },
  question: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  option: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedOption: { backgroundColor: "#e0f0ff", borderColor: "#007bff" },
  optionText: { fontSize: 16 },
  nextButton: {
    backgroundColor: "#007bff",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  nextButtonText: { color: "white", fontWeight: "bold" },
  resultText: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
  },
  scoreText: { fontSize: 20, textAlign: "center" },
  animation: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -50 }, { translateY: -50 }],
    width: 150,
    height: 150,
  },
});

export default Quiz;
