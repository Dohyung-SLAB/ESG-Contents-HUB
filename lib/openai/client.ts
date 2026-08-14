import OpenAI from "openai";

/**
 * OpenAI client stub — installed for later tasks.
 * Do not call the API in Task 01.
 */
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI API 키가 설정되지 않았습니다. .env.local에 OPENAI_API_KEY를 추가하세요.",
    );
  }

  return new OpenAI({ apiKey });
}
