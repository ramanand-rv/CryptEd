import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

interface Course {
  _id: string;
  title: string;
  description: string;
  price: number;
  educatorId: { name: string };
}

const CourseListScreen = ({ navigation }: any) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/courses");
      setCourses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const renderCourse = ({ item }: { item: Course }) => (
    <TouchableOpacity
      style={styles.courseCard}
      onPress={() =>
        navigation.navigate("CourseDetail", { courseId: item._id })
      }
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text numberOfLines={2} style={styles.description}>
        {item.description}
      </Text>
      <Text style={styles.price}>Price: {item.price / 1e9} SOL</Text>
      <Text style={styles.educator}>By {item.educatorId?.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={courses}
        keyExtractor={(item) => item._id}
        renderItem={renderCourse}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  list: { padding: 16 },
  courseCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  description: { color: "#666", marginBottom: 8 },
  price: { fontWeight: "600", color: "#2ecc71", marginBottom: 4 },
  educator: { color: "#888", fontSize: 12 },
});

export default CourseListScreen;
