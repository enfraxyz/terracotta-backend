const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.createThread = async () => {
  const thread = await openai.beta.threads.create();
  return thread.id;
};

exports.addMessageToThread = async (threadId, message) => {
  await openai.beta.threads.messages.create(threadId, { role: "user", content: message });
};

exports.retrieveThread = async (threadId) => {
  const threads = await openai.beta.threads.retrieve(threadId);
  return threads.data.find((thread) => thread.metadata?.pull_request_id === pullRequestId);
};

exports.runThread = async (threadId) => {
  const response = await openai.beta.threads.runs.create(threadId, {
    assistant_id: process.env.TERRACOTTA_ASSISTANT_ID,
  });

  return response;
};

exports.runTerraformPlan = async (plan) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: plan }],
  });

  return response.choices[0].message.content;
};
