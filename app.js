const messagesEl = document.getElementById("messages");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const codeEl = document.getElementById("code");
const copyBtn = document.getElementById("copy");

function addMessage(text, isUser = false) {
  const div = document.createElement("div");
  div.className = `message ${isUser ? "user" : "ai"}`;
  div.innerHTML = isUser ? text : `<strong>ANVIL:</strong> ${text}`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function mockAIResponse(prompt) {
  // Simple demo responses — replace with real AI API later
  if (prompt.toLowerCase().includes("react")) {
    return `Here's a simple React component:\n\n\`\`\`jsx\nfunction Welcome({ name }) {\n  return <h1>Hello, {name}!</h1>;\n}\n\`\`\``;
  }
  if (prompt.toLowerCase().includes("python") || prompt.toLowerCase().includes("function")) {
    return `Here's a Python function example:\n\n\`\`\`python\ndef greet(name):\n    return f"Hello, {name}!"\n\nprint(greet("ANVIL"))\n\`\`\``;
  }
  return `I can help you with that! Here's a starting point:\n\n\`\`\`javascript\n// ${prompt.slice(0, 50)}...\nfunction solution() {\n  // Your code here\n  console.log("Built with ANVIL");\n}\n\`\`\`\n\nTell me more details and I'll refine it.`;
}

sendBtn.addEventListener("click", () => {
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  addMessage(prompt, true);
  promptEl.value = "";

  // Simulate thinking
  setTimeout(() => {
    const response = mockAIResponse(prompt);
    addMessage(response);
    
    // Extract code block if present and put in editor
    const codeMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      codeEl.value = codeMatch[1].trim();
    }
  }, 600);
});

promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

copyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(codeEl.value);
  copyBtn.textContent = "Copied!";
  setTimeout(() => copyBtn.textContent = "Copy", 1500);
});
