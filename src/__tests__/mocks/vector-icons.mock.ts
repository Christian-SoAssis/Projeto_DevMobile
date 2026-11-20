import React from 'react';

const createIcon = (family: string) => {
  const IconComponent = React.forwardRef(({ name, size, color, ...props }: any, ref: any) =>
    React.createElement('Icon', { family, name, size, color, ...props, ref })
  );
  (IconComponent as any).displayName = family;
  return IconComponent;
};

export const Ionicons = createIcon('Ionicons');
export const MaterialIcons = createIcon('MaterialIcons');
export const FontAwesome = createIcon('FontAwesome');
export const Feather = createIcon('Feather');
export const AntDesign = createIcon('AntDesign');
export const MaterialCommunityIcons = createIcon('MaterialCommunityIcons');

export default {
  Ionicons,
  MaterialIcons,
  FontAwesome,
  Feather,
  AntDesign,
  MaterialCommunityIcons,
};
