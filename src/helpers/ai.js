const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// This creates a new thread for us to store in the User model
exports.createThread = async () => {
  const thread = await openai.beta.threads.create();
  return thread.id;
};

// This adds a message to the thread, we'd need to run this with RunThread
exports.addMessageToThread = async (threadId, message) => {
  await openai.beta.threads.messages.create(threadId, { role: "user", content: message });
};

// This retrieves the thread from the User model
exports.retrieveThread = async (threadId) => {
  const threads = await openai.beta.threads.retrieve(threadId);
  return threads.data.find((thread) => thread.metadata?.pull_request_id === pullRequestId);
};

// This runs the thread, we'd need to run this with RunThread
exports.runThread = async (threadId) => {
  const response = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: process.env.TERRACOTTA_ASSISTANT_ID,
  });

  if (response.status === "completed") {
    const messages = await openai.beta.threads.messages.list(threadId);

    console.log("[AI] Messages:", messages.data);

    // return the last message
    return messages.data[0].content[0].text.value;
  } else {
    console.log("--------------------------", response.status);
    throw new Error("Run did not complete successfully");
  }
};

exports.runTerraformPlan = async (plan) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: plan }],
  });

  return response.choices[0].message.content;
};

exports.simpleMessage = async (context) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: context }],
  });

  return response.choices[0].message.content;
};
