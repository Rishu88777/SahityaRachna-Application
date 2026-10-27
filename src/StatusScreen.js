import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { COLORS } from './config';

const MESSAGES = {
  offline: {
    emoji: '📡',
    title: 'No internet connection',
    body: 'Please check your Wi-Fi or mobile data and try again. We will reload automatically when you are back online.',
  },
  timeout: {
    emoji: '⏳',
    title: 'Taking too long',
    body: 'The page is taking longer than usual to load. Your connection may be slow.',
  },
  server: {
    emoji: '🛠️',
    title: 'Server is unavailable',
    body: 'Sahitya Rachna is having trouble right now. Please try again in a moment.',
  },
  ssl: {
    emoji: '🔒',
    title: 'Secure connection problem',
    body: 'We could not make a secure connection. Please check that your phone date and time are correct, then try again.',
  },
  generic: {
    emoji: '⚠️',
    title: 'Something went wrong',
    body: 'We could not load the page. Please try again.',
  },
};

export default function StatusScreen({ type = 'generic', onRetry }) {
  const m = MESSAGES[type] ?? MESSAGES.generic;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.emoji}>{m.emoji}</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.body}>{m.body}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    zIndex: 20,
    elevation: 20,
  },
  // Centered, width-capped column: reads well on tablets and scrolls in short landscape windows.
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    padding: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: COLORS.muted, textAlign: 'center', marginBottom: 28 },
  button: { backgroundColor: COLORS.primary, paddingHorizontal: 36, paddingVertical: 13, borderRadius: 28 },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
