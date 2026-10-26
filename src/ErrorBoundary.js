import { Component } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './config';

// Last line of defence: a JavaScript error anywhere in the app shows this screen
// (with the error text, so it can be reported) instead of closing the app.
export default class ErrorBoundary extends Component {
  state = { error: null, showDetails: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>Sorry about that. Tap below to restart the app.</Text>
        <Pressable style={styles.button} onPress={() => this.setState({ error: null })}>
          <Text style={styles.buttonText}>Restart</Text>
        </Pressable>
        <Pressable onPress={() => this.setState((s) => ({ showDetails: !s.showDetails }))}>
          <Text style={styles.link}>{this.state.showDetails ? 'Hide details' : 'Show details'}</Text>
        </Pressable>
        {this.state.showDetails && (
          <ScrollView style={styles.log}>
            <Text style={styles.logText}>{String(error?.stack || error?.message || error)}</Text>
          </ScrollView>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background, padding: 28, paddingTop: 80, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  body: { fontSize: 15, color: COLORS.muted, textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: COLORS.primary, paddingHorizontal: 36, paddingVertical: 13, borderRadius: 28 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 22, color: COLORS.muted, fontSize: 13, textDecorationLine: 'underline' },
  log: { marginTop: 24, alignSelf: 'stretch' },
  logText: { fontSize: 11, color: COLORS.muted },
});
