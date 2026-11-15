import os
import zipfile

paper_dir = r"c:\Users\KRISH\Desktop\Multi-Agent-Flow\paper"
zip_path = r"C:\Users\KRISH\Desktop\Multi_Agent_Flow_Overleaf_Package.zip"

files_to_pack = [
    "main.tex",
    "references.bib",
    "fig_architecture.png",
    "fig_workflow.png",
    "fig_heatmap.png",
    "boxplot.png"
]

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    for filename in files_to_pack:
        file_path = os.path.join(paper_dir, filename)
        if os.path.exists(file_path):
            zipf.write(file_path, arcname=filename)
            print(f"Added {filename} ({os.path.getsize(file_path):,} bytes)")
        else:
            print(f"ERROR: {filename} not found!")

print(f"\nZip archive created successfully at: {zip_path}")
print(f"Archive size: {os.path.getsize(zip_path):,} bytes")
