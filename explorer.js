// Simple file explorer mock data
const FILES = [
  { name: "index.html", type: "file" },
  { name: "styles.css", type: "file" },
  { name: "app.js", type: "file" },
  { name: "config.js", type: "file" },
  { name: "README.md", type: "file" }
];

function renderFileTree() {
  const tree = document.getElementById("file-tree");
  if (!tree) return;
  tree.innerHTML = FILES.map(f => 
    `<div class="file-item" data-name="${f.name}">📄 ${f.name}</div>`
  ).join("");

  tree.querySelectorAll(".file-item").forEach(el => {
    el.addEventListener("click", () => {
      document.getElementById("filename").textContent = el.dataset.name;
      // In a real app this would load file content
    });
  });
}

document.addEventListener("DOMContentLoaded", renderFileTree);
