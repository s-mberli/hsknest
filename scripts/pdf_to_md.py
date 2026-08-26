import sys
import pdfplumber

def convert(pdf_path, out_path):
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            lines.append(f"\n## Page {i+1}\n")
            tables = page.extract_tables()
            if tables:
                for t in tables:
                    for row in t:
                        cells = [(c or "").replace("\n", " ").strip() for c in row]
                        lines.append(" | ".join(cells))
                    lines.append("")
            else:
                text = page.extract_text() or ""
                lines.append(text)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"wrote {out_path}")

if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2])
