import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from 'react-native';
import { COLORS } from './config';

const { width: W, height: H } = Dimensions.get('window');
// Matches the native splash image width so the hand-off from native to JS has no jump.
const LOGO_W = 200;
const LOGO_H = Math.round((LOGO_W * 334) / 600);

const BUBBLES = [
  { x: 0.12, size: 46, color: COLORS.primary, delay: 0, dur: 5200 },
  { x: 0.78, size: 64, color: '#F48FB1', delay: 600, dur: 6200 },
  { x: 0.35, size: 28, color: COLORS.accent, delay: 1200, dur: 4800 },
  { x: 0.62, size: 38, color: COLORS.primary, delay: 300, dur: 5600 },
  { x: 0.9, size: 24, color: COLORS.accent, delay: 1800, dur: 4400 },
  { x: 0.22, size: 56, color: '#CE93D8', delay: 900, dur: 6600 },
  { x: 0.5, size: 20, color: '#E53935', delay: 1500, dur: 4200 },
];

const loop = (anim, duration, easing = Easing.inOut(Easing.sin)) =>
  Animated.loop(
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration, easing, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration, easing, useNativeDriver: true }),
    ]),
  );

function Bubble({ x, size, color, delay, dur }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [t, delay, dur]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x * W - size / 2,
        top: H * 0.75,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: t.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.22, 0.12, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -H * 0.6] }) },
          { translateX: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 14, -10] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) },
        ],
      }}
    />
  );
}

function Dot({ color, index }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 160),
        Animated.timing(t, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.delay((2 - index) * 160),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [t, index]);
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) },
          ],
        },
      ]}
    />
  );
}

// Full-screen overlay that fades out once `visible` turns false.
export default function SplashOverlay({ visible, onHidden }) {
  const exit = useRef(new Animated.Value(0)).current; // 0 = showing, 1 = gone
  const drift = useRef(new Animated.Value(0)).current; // background pan/zoom
  const pop = useRef(new Animated.Value(0)).current; // logo entrance bounce
  const bob = useRef(new Animated.Value(0)).current; // logo float + sway
  const line = useRef(new Animated.Value(0)).current; // underline sweep
  const dotsIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = [loop(drift, 6000), loop(bob, 1800)];
    loops.forEach((l) => l.start());
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 70, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(line, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dotsIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
    return () => loops.forEach((l) => l.stop());
  }, [drift, bob, pop, line, dotsIn]);

  useEffect(() => {
    if (visible) return;
    Animated.timing(exit, {
      toValue: 1,
      duration: 450,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => finished && onHidden());
  }, [visible, exit, onHidden]);

  const bubbles = useMemo(() => BUBBLES.map((b, i) => <Bubble key={i} {...b} />), []);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        StyleSheet.absoluteFill,
        styles.root,
        { opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
      ]}
    >
      <Animated.Image
        source={require('../assets/splash-bg.jpg')}
        resizeMode="cover"
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.05, 1.18] }) },
              { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-12, 12] }) },
              { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [8, -8] }) },
            ],
          },
        ]}
      />
      {bubbles}
      <Animated.View
        style={[
          styles.center,
          { transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] },
        ]}
      >
        <Animated.Image
          source={require('../assets/splash-icon.png')}
          resizeMode="contain"
          style={{
            width: LOGO_W,
            height: LOGO_H,
            transform: [
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [3, -7] }) },
              { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-1.2deg', '1.2deg'] }) },
              // starts at full size (matches native splash), then pops and settles
              { scale: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0.94, 1.06] }) },
            ],
          }}
        />
        <Animated.View
          style={[
            styles.line,
            {
              opacity: line,
              transform: [{ scaleX: line }],
            },
          ]}
        />
        <Animated.View style={[styles.dots, { opacity: dotsIn }]}>
          <Dot color={COLORS.primary} index={0} />
          <Dot color={COLORS.accent} index={1} />
          <Dot color="#E53935" index={2} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 10, elevation: 10, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  line: { width: 120, height: 3, borderRadius: 2, marginTop: 14, backgroundColor: COLORS.primary },
  dots: { flexDirection: 'row', marginTop: 28, height: 24, alignItems: 'flex-end' },
  dot: { width: 9, height: 9, borderRadius: 5, marginHorizontal: 5 },
});
