import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const createThread = async (pullRequestId: string) => {
  const thread = await openai.beta.threads.create();
  return thread.id;
};

const addMessageToThread = async (threadId: string, message: string) => {
  await openai.beta.threads.messages.create(threadId, { role: "user", content: message });
};

const findThread = async (pullRequestId: string) => {
  const threads = await openai.beta.threads.
  return threads.data.find((thread) => thread.metadata?.pull_request_id === pullRequestId);
};



