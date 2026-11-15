import re

with open(r"c:\Users\KRISH\Desktop\Multi-Agent-Flow\paper\main.tex", "r", encoding="utf-8") as f:
    text = f.read()

with open(r"c:\Users\KRISH\Desktop\Multi-Agent-Flow\paper\references.bib", "r", encoding="utf-8") as f:
    bib = f.read()

bib_keys = set(re.findall(r"@\w+\{([^,]+),", bib))
cites = re.findall(r"\\cite\{([^}]+)\}", text)
used_keys = set()
for c in cites:
    for k in c.split(","):
        used_keys.add(k.strip())

print("Total bib keys in file:", len(bib_keys))
print("Total keys cited in text:", len(used_keys))
print("Missing in bib:", used_keys - bib_keys)
print("Unused in bib:", bib_keys - used_keys)

def clean_and_count(t):
    t = re.sub(r"%.*", "", t)
    t = re.sub(r"\\cite\{.*?\}", "ref", t)
    t = re.sub(r"\\ref\{.*?\}", "1", t)
    t = re.sub(r"\\\w+(\[.*?\])?(\{.*?\})?", " ", t)
    t = re.sub(r"[\$\{\}\\\_]", " ", t)
    words = re.findall(r"\b[a-zA-Z0-9_-]+\b", t)
    return len(words)

# Check abstract
abs_m = re.search(r"\\begin\{abstract\}(.*?)\\end\{abstract\}", text, re.DOTALL)
if abs_m:
    print(f"\nAbstract: {clean_and_count(abs_m.group(1))} words (Target: 200-250)")

# Split text by section
parts = re.split(r"\\section\*?\{([^}]+)\}", text)
total_body = 0
targets = {
    "Introduction": "600-800",
    "Related Work": "700-900",
    "Background and Problem Formulation": "300-500",
    "Proposed Methodology": "900-1200",
    "Experimental Setup": "400-600",
    "Results and Analysis": "800-1000",
    "Discussion": "300-500",
    "Conclusion and Future Work": "200-300"
}

print("\n--- SECTION WORD COUNTS ---")
for i in range(1, len(parts), 2):
    sec_name = parts[i]
    sec_content = parts[i+1]
    if "IEEEtran" in sec_content or "bibliography" in sec_content:
        sec_content = sec_content.split(r"\bibliographystyle")[0]
    count = clean_and_count(sec_content)
    target = targets.get(sec_name, "N/A")
    if not sec_name.startswith("Code") and not sec_name.startswith("AI") and not sec_name.startswith("Author"):
        total_body += count
    print(f"{sec_name}: {count} words (Target: {target})")

print(f"\nTotal Main Body (Sections I-VIII): {total_body} words (Target: 4,500 - 5,500 words)")
