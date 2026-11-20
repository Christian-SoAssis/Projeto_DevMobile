import React from 'react';

export const View = React.forwardRef((props: any, ref: any) =>
  React.createElement('View', { ...props, ref })
);
(View as any).displayName = 'View';

export const Text = React.forwardRef((props: any, ref: any) =>
  React.createElement('Text', { ...props, ref })
);
(Text as any).displayName = 'Text';

export const TouchableOpacity = React.forwardRef(({ onPress, children, ...props }: any, ref: any) =>
  React.createElement('TouchableOpacity', { onClick: onPress, onPress, ...props, ref }, children)
);
(TouchableOpacity as any).displayName = 'TouchableOpacity';

export const Pressable = React.forwardRef(({ onPress, children, ...props }: any, ref: any) =>
  React.createElement('Pressable', { onClick: onPress, onPress, ...props, ref }, children)
);
(Pressable as any).displayName = 'Pressable';

export const TextInput = React.forwardRef(({ onChangeText, value, ...props }: any, ref: any) =>
  React.createElement('TextInput', {
    onChange: (e: any) => onChangeText?.(e?.target?.value ?? e),
    onChangeText,
    value,
    ...props,
    ref,
  })
);
(TextInput as any).displayName = 'TextInput';

export const ScrollView = React.forwardRef((props: any, ref: any) =>
  React.createElement('ScrollView', { ...props, ref })
);
(ScrollView as any).displayName = 'ScrollView';

export const FlatList = React.forwardRef(({ data, renderItem, ListEmptyComponent, ...props }: any, ref: any) => {
  const content = (data && data.length > 0)
    ? data.map((item: any, index: number) => {
        const rendered = renderItem?.({ item, index });
        const key = rendered?.key ?? item?.id ?? item?.key ?? String(index);
        return React.isValidElement(rendered)
          ? React.cloneElement(rendered, { key })
          : rendered;
      })
    : (typeof ListEmptyComponent === 'function' ? React.createElement(ListEmptyComponent, { key: 'empty' }) : ListEmptyComponent);
  return React.createElement('FlatList', { ...props, ref }, content);
});
(FlatList as any).displayName = 'FlatList';

export const Modal = React.forwardRef(({ visible = true, children, ...props }: any, ref: any) =>
  visible ? React.createElement('Modal', { ...props, ref }, children) : null
);
(Modal as any).displayName = 'Modal';

export const Image = React.forwardRef((props: any, ref: any) =>
  React.createElement('Image', { ...props, ref })
);
(Image as any).displayName = 'Image';

export const Button = React.forwardRef(({ onPress, title, ...props }: any, ref: any) =>
  React.createElement('Button', { onClick: onPress, onPress, title, ...props, ref })
);
(Button as any).displayName = 'Button';

export const ActivityIndicator = React.forwardRef((props: any, ref: any) =>
  React.createElement('ActivityIndicator', { ...props, ref })
);
(ActivityIndicator as any).displayName = 'ActivityIndicator';

export const KeyboardAvoidingView = React.forwardRef((props: any, ref: any) =>
  React.createElement('KeyboardAvoidingView', { ...props, ref })
);
(KeyboardAvoidingView as any).displayName = 'KeyboardAvoidingView';

export const SafeAreaView = React.forwardRef((props: any, ref: any) =>
  React.createElement('SafeAreaView', { ...props, ref })
);
(SafeAreaView as any).displayName = 'SafeAreaView';

export const StyleSheet = {
  create: (obj: any) => obj,
  flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
};

export const Alert = {
  alert: jest.fn(),
};

export const Platform = {
  OS: 'ios',
  select: (obj: any) => obj.default ?? obj.ios ?? obj.android,
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812 }),
};

export const PixelRatio = {
  get: () => 1,
};

export const StatusBar = {
  setBackgroundColor: jest.fn(),
  setBarStyle: jest.fn(),
};

export const Linking = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  openURL: jest.fn(),
};

export const AppState = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  currentState: 'active',
};

export const useWindowDimensions = () => ({ width: 375, height: 812 });
export const useColorScheme = () => 'light';

const reactNative = {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  FlatList,
  Modal,
  Image,
  Button,
  ActivityIndicator,
  KeyboardAvoidingView,
  SafeAreaView,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  PixelRatio,
  StatusBar,
  Linking,
  AppState,
  useWindowDimensions,
  useColorScheme,
};

export default reactNative;
