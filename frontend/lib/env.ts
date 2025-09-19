export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  
  // Debug information
  console.log('Environment check:', {
    hasApiKey: !!apiKey,
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('GEMINI')),
  });
  
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Please add it to your .env.local file:\n' +
      'GEMINI_API_KEY=your_api_key_here'
    );
  }
  return apiKey;
}

// Validate environment variables at startup - now optional
export function validateEnv() {
  try {
    getGeminiApiKey();
    console.log('Environment variables validated successfully');
  } catch (error) {
    console.error('Environment validation failed:', error);
    // Don't throw in development to allow the app to start
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
} 