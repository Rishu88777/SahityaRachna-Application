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

// Android (net::ERR_*) and iOS (NSURLErrorDomain) descriptions that mean "no usable connection".
const OFFLINE_RE =
  /INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NETWORK_CHANGED|CONNECTION_(REFUSED|RESET|CLOSED|TIMED_OUT)|ADDRESS_UNREACHABLE|not connected to the internet|offline/i;

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
  const errorRef = useRef(null);

  const [error, setError] = useState(null); // null | 'offline' | 'timeout' | 'server' | 'generic'
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

  // While an error screen is up, quietly probe the site and reload as soon as it answers.
  useEffect(() => {
    if (!error) return;
    let stopped = false;
    const probe = async () => {
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = setTimeout(() => ctl && ctl.abort(), 6000);
      try {
        const res = await fetch(SITE_URL, {
          method: 'HEAD',
          cache: 'no-store',
          signal: ctl ? ctl.signal : undefined,
        });
        if (!stopped && res.status < 500) retry();
      } catch {
        // still unreachable; try again on the next tick
      } finally {
        clearTimeout(timer);
      }
    };
    const id = setInterval(probe, 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [error, retry]);

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

  const showStatus = error;

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
            onError={({ nativeEvent }) =>
              fail(OFFLINE_RE.test(nativeEvent?.description || '') ? 'offline' : 'generic')
            }
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
