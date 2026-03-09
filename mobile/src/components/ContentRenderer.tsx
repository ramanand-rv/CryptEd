import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Video } from "expo-av";
import RenderHTML from "react-native-render-html";

interface Block {
  type: string;
  attrs?: any;
  content?: any[];
  text?: string;
}

interface ContentRendererProps {
  blocks: Block[];
  onQuizComplete?: (score: number) => void; // will handle later
}

const ContentRenderer: React.FC<ContentRendererProps> = ({ blocks }) => {
  const renderBlock = (block: Block, index: number) => {
    switch (block.type) {
      case "paragraph":
        return (
          <View key={index} style={styles.paragraph}>
            <Text>{block.content?.[0]?.text || ""}</Text>
          </View>
        );
      case "heading":
        const level = block.attrs?.level || 1;
        const fontSize = level === 1 ? 24 : level === 2 ? 20 : 18;
        return (
          <Text
            key={index}
            style={[styles.heading, { fontSize, fontWeight: "bold" }]}
          >
            {block.content?.[0]?.text || ""}
          </Text>
        );
      case "bulletList":
      case "orderedList":
        // For simplicity, just render as text – you can enhance later
        return (
          <View key={index}>
            {block.content?.map((item: any, i: number) => (
              <Text key={i} style={styles.listItem}>
                {block.type === "bulletList" ? "• " : `${i + 1}. `}
                {item.content?.[0]?.text || ""}
              </Text>
            ))}
          </View>
        );
      case "video":
        // YouTube video – you might need a WebView or better handling
        // For now, we'll show placeholder
        return (
          <View key={index} style={styles.videoPlaceholder}>
            <Text>Video: {block.attrs?.src || "URL not available"}</Text>
          </View>
        );
      case "image":
        return (
          <View key={index} style={styles.imagePlaceholder}>
            <Text>Image: {block.attrs?.src || ""}</Text>
          </View>
        );
      case "quiz":
        // Will implement later
        return (
          <View key={index} style={styles.quizPlaceholder}>
            <Text>Quiz block (to be implemented)</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return <ScrollView>{blocks.map(renderBlock)}</ScrollView>;
};

const styles = StyleSheet.create({
  paragraph: { marginVertical: 8 },
  heading: { marginVertical: 8 },
  listItem: { marginLeft: 16, marginVertical: 2 },
  videoPlaceholder: {
    height: 200,
    backgroundColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 8,
  },
  imagePlaceholder: {
    height: 150,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 8,
  },
  quizPlaceholder: {
    padding: 16,
    backgroundColor: "#f0f0f0",
    marginVertical: 8,
  },
});

export default ContentRenderer;
