import React from 'react';
import { View, Text } from 'react-native';

// Mock para react-native-maps usado nos testes do HomeScreen.
export const PROVIDER_GOOGLE = 'google';

// MapView como default export (forma como o pacote real exporta).
export default React.memo(function MapViewMock(props: any) {
  return React.createElement(View, { style: props.style }, props.children);
});

// Marker como named export.
export const Marker = React.memo(function MarkerMock(props: any) {
  return React.createElement(View, null, React.createElement(Text, null, props.title));
});
