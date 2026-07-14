import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import FeedScreen from './src/screens/FeedScreen';
import { login, setToken } from './src/api/client';

const COLORS = {
  bg: '#F5F0E8',
  ink: '#2C2420',
  muted: '#7A6F66',
  accent: '#C45C3E',
  card: '#FFFCF7',
  border: '#E8DFD3',
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [email, setEmail] = useState('dev@guisedup.test');
  const [password, setPassword] = useState('password');

  useEffect(() => {
    // auto-login for demo; swap to persisted token in prod
    (async () => {
      try {
        const res = await login('dev@guisedup.test', 'password');
        setToken(res.token);
        setReady(true);
      } catch {
        setReady(false);
      }
    })();
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const res = await login(email.trim(), password);
      setToken(res.token);
      setReady(true);
    } catch (e) {
      setAuthError(e.message);
    }
  };

  if (!ready) {
    return (
      <KeyboardAvoidingView
        style={styles.loginWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar style="dark" />
        <Text style={styles.loginLogo}>guised up</Text>
        <Text style={styles.loginSub}>Sign in to see your Real Connections feed</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#A89E94"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#A89E94"
          />

          {authError && <Text style={styles.authError}>{authError}</Text>}

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
            <Text style={styles.loginBtnText}>Continue</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>Seeded: dev@guisedup.test / password</Text>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <FeedScreen />
    </>
  );
}

const styles = StyleSheet.create({
  loginWrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    padding: 24,
  },
  loginLogo: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
  },
  loginSub: {
    textAlign: 'center',
    color: COLORS.muted,
    marginTop: 8,
    marginBottom: 28,
  },
  form: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: '#FAF7F2',
  },
  loginBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  authError: {
    color: '#9A3B28',
    marginBottom: 8,
    fontSize: 13,
  },
  hint: {
    textAlign: 'center',
    marginTop: 14,
    fontSize: 12,
    color: COLORS.muted,
  },
});
