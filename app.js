const messagesEl = document.getElementById("messages");
const promptEl = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const codeEl = document.getElementById("code");
const copyBtn = document.getElementById("copy");
const runBtn = document.getElementById("run");
const outputEl = document.getElementById("output");
const newChatBtn = document.getElementById("new-chat");
const filenameEl = document.getElementById("filename");

function addMessage(text, isUser = false) {
  const div = document.createElement("div");
  div.className = `message ${isUser ? "user" : "ai"}`;
  div.innerHTML = isUser ? text : `<strong>ANVIL:</strong> ${text}`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function mockAIResponse(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("react") || p.includes("component")) {
    filenameEl.textContent = "App.jsx";
    return `Here's a React component:\n\n\`\`\`jsx\nfunction App() {\n  return (\n    <div>\n      <h1>Hello from ANVIL</h1>\n      <p>Built as a web-based coding assistant.</p>\n    </div>\n  );\n}\nexport default App;\n\`\`\``;
  }
  if (p.includes("python") || p.includes("flask") || p.includes("django")) {
    filenameEl.textContent = "app.py";
    return `Python example:\n\n\`\`\`python\ndef main():\n    print("ANVIL is ready")\n    return "success"\n\nif __name__ == "__main__":\n    main()\n\`\`\``;
  }
  if (p.includes("html") || p.includes("css") || p.includes("page")) {
    filenameEl.textContent = "index.html";
    return `Simple page:\n\n\`\`\`html\n<!DOCTYPE html>\n<html>\n<head><title>ANVIL</title></head>\n<body>\n  <h1>Built with ANVIL</h1>\n</body>\n</html>\n\`\`\``;
  }
  filenameEl.textContent = "main.js";
  return `Starting point for: "${prompt.slice(0, 60)}"\n\n\`\`\`javascript\nfunction solution() {\n  // TODO: implement\n  console.log("ANVIL generated this");\n  return true;\n}\nsolution();\n\`\`\`\n\nGive me more details and I’ll improve it.`;
}

sendBtn.addEventListener("click", () => {
  const prompt = promptEl.value.trim();
  if (!prompt) return;

  addMessage(prompt, true);
  promptEl.value = "";

  setTimeout(() => {
    const response = mockAIResponse(prompt);
    addMessage(response);

    const codeMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      codeEl.value = codeMatch[1].trim();
    }
  }, 500);
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
  setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
});

runBtn.addEventListener("click", () => {
  outputEl.innerHTML = "<em>Running...</em>";
  try {
    const result = new Function(codeEl.value)();
    outputEl.textContent = result !== undefined ? String(result) : "Ran successfully (no return value)";
  } catch (err) {
    outputEl.textContent = "Error: " + err.message;
  }
});

newChatBtn.addEventListener("click", () => {
  messagesEl.innerHTML = `
    <div class="message ai">
      <strong>ANVIL:</strong> New chat started. What do you want to build?
    </div>`;
  codeEl.value = "// New session\nconsole.log('ANVIL');";
  filenameEl.textContent = "main.js";
  outputEl.textContent = "";
});
