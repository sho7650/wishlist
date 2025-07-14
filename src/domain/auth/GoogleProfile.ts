/**
 * Google OAuth profile interface
 * Represents the data received from Google OAuth
 */
export interface GoogleProfile {
  id: string;
  displayName: string;
  emails?: Array<{ value: string }>;
  photos?: Array<{ value: string }>;
}

/**
 * Type guard to check if an object is a valid GoogleProfile
 */
export function isGoogleProfile(obj: any): obj is GoogleProfile {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.displayName === 'string' &&
    obj.id.length > 0 &&
    obj.displayName.length > 0
  );
}