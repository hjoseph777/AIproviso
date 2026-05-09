import re

with open('C:/Users/Owner/Xerox/proviso/Proviso_App_cacoo.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = '''const simulateCacooFetch = async (diagramId, apiKey) => {
  if (!diagramId.trim() || !apiKey.trim()) throw new Error("Diagram ID and API Key required");
  const response = await fetch("http://localhost:5000/api/cacoo-fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ diagramId, apiKey })
  });
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || "Failed to fetch from backend");
  }
  return await response.json();
};'''

new_content = re.sub(
    r'const simulateCacooFetch = async.*?return CACOO_MOCK;\n};',
    replacement,
    content,
    flags=re.DOTALL
)

with open('C:/Users/Owner/Xerox/proviso/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
