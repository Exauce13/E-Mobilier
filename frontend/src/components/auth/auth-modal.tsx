import { router } from 'expo-router';
import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoginView } from '@/components/auth/login-view';
import { RegisterView } from '@/components/auth/register-view';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

export function AuthModal() {
  const theme = useTheme();
  const {
    authModalVisible,
    authModalMode,
    closeAuthModal,
    setAuthModalMode,
  } = useAuth();

  if (!authModalVisible) return null;

  const handleAuthSuccess = () => {
    closeAuthModal();
    router.replace('/' as any);
  };

  return (
    <Modal
      visible={authModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeAuthModal}>
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.content}>
          {authModalMode === 'login' ? (
            <LoginView
              onNavigateToRegister={() => setAuthModalMode('register')}
              onBack={closeAuthModal}
              onSuccessLogin={handleAuthSuccess}
            />
          ) : (
            <RegisterView
              onNavigateToLogin={() => setAuthModalMode('login')}
              onBack={closeAuthModal}
              onSuccessRegister={handleAuthSuccess}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
