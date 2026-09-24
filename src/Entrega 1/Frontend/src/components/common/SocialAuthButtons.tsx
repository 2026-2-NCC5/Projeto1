import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { colors, spacing } from '../../theme';

interface SocialAuthButtonsProps {
  onPressGoogle?: () => void;
  onPressApple?: () => void;
  onPressFacebook?: () => void;
}

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({
  onPressGoogle,
  onPressApple,
  onPressFacebook,
}) => {
  return (
    <View style={styles.container}>
      {/* Google Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPressGoogle}
        style={styles.socialButton}
      >
        <Svg width={28} height={28} viewBox="0 0 48 48">
          <Path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <Path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <Path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <Path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </Svg>
      </TouchableOpacity>

      {/* Apple Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPressApple}
        style={styles.socialButton}
      >
        <Svg width={28} height={28} viewBox="0 0 170 170">
          <Path
            fill="#000000"
            d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.81-11.94-14.33-6.29-9.53-11.26-20.73-14.92-33.62-3.66-12.88-5.49-24.64-5.49-35.26 0-13.82 3.51-25.29 10.53-34.42 7.02-9.13 15.82-13.79 26.4-13.99 4.36 0 9.38 1.15 15.06 3.44 5.68 2.29 9.39 3.48 11.13 3.56 1.3 0 5.24-1.3 11.83-3.9 6.59-2.6 12.33-3.72 17.23-3.36 12.88.94 23.08 5.75 30.61 14.42-11.23 6.81-16.71 16.29-16.44 28.44.27 9.54 3.94 17.51 11.02 23.9 7.08 6.39 15.65 10.02 25.71 10.9-2.18 6.43-4.91 12.72-8.19 18.87zM119.22 33.15c0-6.72 2.45-13.14 7.35-19.26 4.9-6.12 11.12-10.26 18.66-12.42.79 3.09 1.18 5.96 1.18 8.61 0 6.64-2.58 13.25-7.74 19.82-5.16 6.58-11.66 10.66-19.5 12.25-.44-2.99-.66-6.01-.66-9z"
          />
        </Svg>
      </TouchableOpacity>

      {/* Facebook Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPressFacebook}
        style={styles.socialButton}
      >
        <Svg width={30} height={30} viewBox="0 0 24 24">
          <Path
            fill="#1877F2"
            d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
          />
        </Svg>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xl,
    marginVertical: spacing.lg,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
});
