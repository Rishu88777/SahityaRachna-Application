import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

// Full-screen overlay that fades out once `visible` turns false.
// The logo is sized to match the native splash (240dp) so the hand-off is seamless.
export default function SplashOverlay({ visible, onHidden }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [scale]);

  useEffect(() => {
    if (visible) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(({ finished }) => finished && onHidden());
  }, [visible, opacity, onHidden]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
    >
      <Image source={require('../assets/splash-bg.jpg')} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.center}>
        <Animated.Image
          source={require('../assets/splash-icon.png')}
          style={[styles.logo, { transform: [{ scale }] }]}
          resizeMode="contain"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 10, elevation: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 240, height: 134 },
});
