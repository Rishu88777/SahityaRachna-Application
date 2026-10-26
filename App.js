import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import NetInfo from '@react-native-community/netinfo';
import { WebView } from 'react-native-webview';

import ErrorBoundary from './src/ErrorBoundary';
import SplashOverlay from './src/SplashOverlay';
import StatusScreen from './src/StatusScreen';
import { COLORS, HIDDEN_SELECTORS, LOAD_TIMEOUT_MS, MIN_SPLASH_MS, SITE_HOST, SITE_URL } from './src/config';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Page-level tweaks so the site feels like an app: no grey tap flash, no rubber-band glow.
// Runs before the page renders, so there is no flash of the footer; pure CSS also covers
// content added later by single-page navigation.
const INJECTED_JS = `
  (function () {
    var s = document.createElement('style');
    s.textContent =
      '*{-webkit-tap-highlight-color:transparent;} html,body{overscroll-behavior-y:none;}' +
      ${JSON.stringify(HIDDEN_SELECTORS.join(',') + '{display:none !important;}')};
    (document.head || document.documentElement).appendChild(s);
  })();
  true;
`;

const isInternal = (url) => {
  const m = /^https?:\/\/([^/:?#]+)/i.exec(url || '');
  if (!m) return false;
  const host = m[1].toLowerCase();
  return host === SITE_HOST || host.endsWith('.' + SITE_HOST);
};

// Other schemes (tel:, mailto:, whatsapp:, upi:, intent:) and other websites open outside the app.
const openExternally = (url) =>
  Linking.openURL(url).catch(() => Alert.alert('Unable to open link', 'No app was found to open this link.'));

function Main() {
  const insets = useSafeAreaInsets();
  const webRef = useRef(null);
  const canGoBack = useRef(false);
  const lastBackPress = useRef(0);
  const loadTimer = useRef(null);
  const splashTimerDone = useRef(false);
  const firstLoadSettled = useRef(false);
  const hasLoaded = useRef(false);
  const currentUrl = useRef(SITE_URL);
  const onlineRef = useRef(true);
  const errorRef = useRef(null);

  const [online, setOnline] = useState(true);
  const [error, setError] = useState(null); // null | 'timeout' | 'server' | 'generic'
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashMounted, setSplashMounted] = useState(true);
  const [webKey, setWebKey] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;

  const hideSplash = useCallback(() => {
    if (splashTimerDone.current && firstLoadSettled.current) setSplashVisible(false);
  }, []);

  const settleFirstLoad = useCallback(() => {
    firstLoadSettled.current = true;
    hideSplash();
  }, [hideSplash]);

  // Native splash -> animated splash hand-off, with a minimum display time.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const t = setTimeout(() => {
      splashTimerDone.current = true;
      hideSplash();
    }, MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, [hideSplash]);

  const clearLoadTimer = () => clearTimeout(loadTimer.current);

  const startLoadTimer = () => {
    clearLoadTimer();
    loadTimer.current = setTimeout(() => fail('timeout'), LOAD_TIMEOUT_MS);
  };

  const fail = useCallback(
    (type) => {
      clearTimeout(loadTimer.current);
      errorRef.current = type;
      setError(type);
      settleFirstLoad();
    },
    [settleFirstLoad],
  );

  // Retry in place if a page has already loaded once (keeps the user's spot);
  // otherwise remount so a failed first load starts clean.
  const retry = useCallback(() => {
    errorRef.current = null;
    setError(null);
    if (hasLoaded.current && webRef.current) webRef.current.reload();
    else setWebKey((k) => k + 1);
  }, []);

  // Connectivity: show the offline screen right away, reload automatically on return.
  useEffect(() => {
    let unsubscribe = () => {};
    try {
      unsubscribe = NetInfo.addEventListener((state) => {
        const isOnline = state.isConnected !== false && state.isInternetReachable !== false;
        const wasOnline = onlineRef.current;
        onlineRef.current = isOnline;
        setOnline(isOnline);
        if (!isOnline) settleFirstLoad();
        else if (!wasOnline && (errorRef.current || !hasLoaded.current)) retry();
      });
    } catch {
      // Connectivity info is a nicety; the WebView's own error handling still works without it.
    }
    return unsubscribe;
  }, [retry, settleFirstLoad]);

  // Android hardware back: navigate web history, then press twice to exit.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack.current && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      const now = Date.now();
      if (now - lastBackPress.current < 2000) return false;
      lastBackPress.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => clearLoadTimer, []);

  const onLoadProgress = ({ nativeEvent }) => {
    Animated.timing(progress, {
      toValue: nativeEvent.progress,
      duration: 120,
      useNativeDriver: false,
    }).start();
  };

  const onLoadStart = ({ nativeEvent }) => {
    currentUrl.current = nativeEvent.url;
    startLoadTimer();
    progress.setValue(0.05);
    barOpacity.setValue(1);
  };

  const onLoadEnd = () => {
    clearLoadTimer();
    Animated.timing(progress, { toValue: 1, duration: 120, useNativeDriver: false }).start(() =>
      Animated.timing(barOpacity, { toValue: 0, duration: 250, useNativeDriver: false }).start(),
    );
    settleFirstLoad();
  };

  const onLoad = () => {
    hasLoaded.current = true;
    errorRef.current = null;
    setError(null);
  };

  // Sub-resource failures (a missing image, a failing API call) must not blank the page.
  const onHttpError = ({ nativeEvent }) => {
    if (nativeEvent.statusCode >= 500 && nativeEvent.url === currentUrl.current) fail('server');
  };

  const onShouldStart = (req) => {
    if (isInternal(req.url) || req.url === 'about:blank') return true;
    // Sub-frames (embeds, payment iframes) are left alone; only top-level jumps leave the app.
    if (req.isTopFrame === false) return true;
    openExternally(req.url);
    return false;
  };

  // Offline only blocks the screen before the first page has loaded or after a failed load;
  // otherwise the user keeps reading the page they already have.
  const showStatus = error ? (online ? error : 'offline') : !online && !hasLoaded.current ? 'offline' : null;

  return (
    <View style={styles.root}>
      <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar style="dark" backgroundColor={COLORS.background} />
        <View style={styles.flex}>
          <WebView
            key={webKey}
            ref={webRef}
            source={{ uri: SITE_URL }}
            style={styles.flex}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={onShouldStart}
            onNavigationStateChange={(nav) => {
              canGoBack.current = nav.canGoBack;
            }}
            onLoadStart={onLoadStart}
            onLoadProgress={onLoadProgress}
            onLoad={onLoad}
            onLoadEnd={onLoadEnd}
            onError={() => fail(onlineRef.current ? 'generic' : 'offline')}
            onHttpError={onHttpError}
            onRenderProcessGone={retry}
            onContentProcessDidTerminate={retry}
            injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            mixedContentMode="never"
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction
            pullToRefreshEnabled
            allowsBackForwardNavigationGestures
            overScrollMode="never"
            textZoom={100}
            setBuiltInZoomControls={false}
            decelerationRate="normal"
            startInLoadingState={false}
          />
          <Animated.View pointerEvents="none" style={[styles.barTrack, { opacity: barOpacity }]}>
            <Animated.View
              style={[
                styles.bar,
                { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </Animated.View>
          {showStatus && <StatusScreen type={showStatus} onRetry={retry} />}
        </View>
      </View>
      {splashMounted && <SplashOverlay visible={splashVisible} onHidden={() => setSplashMounted(false)} />}
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <Main />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  barTrack: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 4 },
  bar: { height: 3, backgroundColor: COLORS.primary },
});
