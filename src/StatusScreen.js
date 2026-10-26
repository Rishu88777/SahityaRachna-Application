import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  generic: {
    emoji: '⚠️',
    title: 'Something went wrong',
    body: 'We could not load the page. Please try again.',
  },
};

export default function StatusScreen({ type = 'generic', detail, onRetry }) {
  const m = MESSAGES[type] ?? MESSAGES.generic;
  return (
    <View style={styles.root}>
      <Text style={styles.emoji}>{m.emoji}</Text>
      <Text style={styles.title}>{m.title}</Text>
      <Text style={styles.body}>{m.body}</Text>
      {type === 'generic' && !!detail && <Text style={styles.detail}>{detail}</Text>}
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    zIndex: 5,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: COLORS.muted, textAlign: 'center', marginBottom: 28 },
  detail: { fontSize: 11, color: COLORS.muted, textAlign: 'center', marginBottom: 20, opacity: 0.7 },
  button: { backgroundColor: COLORS.primary, paddingHorizontal: 36, paddingVertical: 13, borderRadius: 28 },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
