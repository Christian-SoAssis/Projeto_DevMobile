export interface CameraPhotoResult {
  uri: string;
  width?: number;
  height?: number;
}

export interface CameraGateway {
  capturePhoto(): Promise<CameraPhotoResult | null>;
  pickImageFromGallery(): Promise<CameraPhotoResult | null>;
}
