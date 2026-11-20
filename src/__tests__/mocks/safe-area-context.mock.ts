import React from 'react';

export const SafeAreaView = React.forwardRef((props: any, ref: any) =>
  React.createElement('SafeAreaView', { ...props, ref })
);
(SafeAreaView as any).displayName = 'SafeAreaView';

export const SafeAreaProvider = ({ children }: any) => children;
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });

export default {
  SafeAreaView,
  SafeAreaProvider,
  useSafeAreaInsets,
};
