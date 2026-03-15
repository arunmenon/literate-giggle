"""PDF export service for question papers using fpdf2."""

from fpdf import FPDF


class PaperPDF(FPDF):
    """Custom PDF class for exam paper layout."""

    def __init__(self, workspace_name=None, paper_title="", **kwargs):
        super().__init__(**kwargs)
        self._workspace_name = workspace_name
        self._paper_title = paper_title

    def header(self):
        self.set_font("Helvetica", "B", 14)
        if self._workspace_name:
            self.cell(0, 8, self._workspace_name, new_x="LMARGIN", new_y="NEXT", align="C")
        self.set_font("Helvetica", "B", 12)
        self.cell(0, 7, self._paper_title, new_x="LMARGIN", new_y="NEXT", align="C")
        self.line(10, self.get_y() + 2, 200, self.get_y() + 2)
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")


def _sanitize_text(text: str) -> str:
    """Replace characters that fpdf2's latin-1 encoding can't handle."""
    replacements = {
        "\u2013": "-",    # en-dash
        "\u2014": "--",   # em-dash
        "\u2018": "'",    # left single quote
        "\u2019": "'",    # right single quote
        "\u201c": '"',    # left double quote
        "\u201d": '"',    # right double quote
        "\u2026": "...",  # ellipsis
        "\u2192": "->",   # right arrow
        "\u2248": "~=",   # approximately equal
        "\u221a": "sqrt", # square root
        "\u03b8": "theta",# theta
        "\u03c0": "pi",   # pi
        "\u00b2": "^2",   # superscript 2
        "\u00b3": "^3",   # superscript 3
        "\u2081": "_1",   # subscript 1
        "\u2082": "_2",   # subscript 2
        "\u2083": "_3",   # subscript 3
        "\u2080": "_0",   # subscript 0
        "\u2084": "_4",
        "\u2099": "_n",
        "\u2091": "_e",
        "\u2093": "_x",
        "\u2096": "_k",
        "\u00b0": " degrees",  # degree symbol
        "\u2260": "!=",   # not equal
        "\u2264": "<=",   # less than or equal
        "\u2265": ">=",   # greater than or equal
        "\u00bd": "1/2",  # fraction
        "\u2153": "1/3",
        "\u2154": "2/3",
        "\u00bc": "1/4",
        "\u00be": "3/4",
        "\u2205": "{}",   # empty set
        "\u2229": " intersection ",
        "\u222a": " union ",
        "\u2208": " in ",
        "\u2282": " subset ",
        "\u221e": "infinity",
        "\u2220": "angle ",
        "\u25b3": "triangle ",
        "\u2245": "~=",   # congruent
        "\u22a5": " perpendicular ",
        "\u2261": "===",  # identical
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    # Remove any remaining non-latin1 characters
    return text.encode("latin-1", errors="replace").decode("latin-1")


def generate_paper_pdf(paper, questions: list[dict], workspace_name: str = None) -> bytes:
    """
    Generate a PDF for a question paper.

    Args:
        paper: QuestionPaper ORM object with title, board, class_grade, subject, etc.
        questions: List of dicts with order, section, marks, question_type, question_text, mcq_options
        workspace_name: Optional workspace name for the header

    Returns:
        PDF file as bytes
    """
    pdf = PaperPDF(
        workspace_name=workspace_name,
        paper_title=_sanitize_text(paper.title),
    )
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=20)

    # Paper metadata
    pdf.set_font("Helvetica", "", 10)
    meta_lines = []
    if paper.board:
        meta_lines.append(f"Board: {paper.board}")
    if paper.class_grade:
        meta_lines.append(f"Class: {paper.class_grade}")
    if paper.subject:
        meta_lines.append(f"Subject: {paper.subject}")

    meta_left = " | ".join(meta_lines)
    meta_right_parts = []
    if paper.total_marks:
        meta_right_parts.append(f"Max Marks: {int(paper.total_marks)}")
    if paper.duration_minutes:
        meta_right_parts.append(f"Duration: {paper.duration_minutes} min")
    meta_right = " | ".join(meta_right_parts)

    pdf.cell(100, 6, meta_left, new_x="RIGHT")
    pdf.cell(0, 6, meta_right, new_x="LMARGIN", new_y="NEXT", align="R")
    pdf.ln(3)

    # Instructions
    if paper.instructions:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(0, 6, "General Instructions:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for line in paper.instructions.split("\n"):
            line_text = _sanitize_text(line.strip())
            if line_text:
                pdf.set_x(10)
                pdf.multi_cell(190, 5, line_text)
        pdf.ln(3)

    # Separator
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)

    # Group questions by section
    current_section = None
    for q in questions:
        section = q.get("section")

        # Section header
        if section and section != current_section:
            current_section = section
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 11)
            section_text = _sanitize_text(section)
            # Find section instructions from paper.sections
            if paper.sections:
                for s in paper.sections:
                    if s.get("name") == section:
                        instr = s.get("instructions", "")
                        marks = s.get("marks", "")
                        if instr:
                            section_text += f" - {_sanitize_text(instr)}"
                        if marks:
                            section_text += f" [{marks} marks]"
                        break
            pdf.cell(0, 7, section_text, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)

        # Question
        order = q.get("order", 0)
        marks = q.get("marks", 0)
        question_text = _sanitize_text(q.get("question_text", ""))
        question_type = q.get("question_type", "")

        # Question number and marks
        pdf.set_font("Helvetica", "B", 10)
        q_label = f"Q{order}."
        marks_label = f"[{int(marks) if marks == int(marks) else marks} marks]"

        # Calculate available width for question text
        label_width = pdf.get_string_width(q_label) + 2
        marks_width = pdf.get_string_width(marks_label) + 2
        text_width = 190 - label_width - marks_width

        # Print question number
        pdf.cell(label_width, 6, q_label)

        # Print question text
        pdf.set_font("Helvetica", "", 10)
        x_before = pdf.get_x()
        y_before = pdf.get_y()

        pdf.multi_cell(text_width, 6, question_text)
        y_after = pdf.get_y()

        # Print marks on the right (at the first line)
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_xy(190 - marks_width + 10, y_before)
        pdf.cell(marks_width, 6, marks_label, align="R")
        pdf.set_y(y_after)

        # MCQ options
        mcq_options = q.get("mcq_options")
        if mcq_options and isinstance(mcq_options, dict):
            pdf.set_font("Helvetica", "", 10)
            option_labels = sorted(mcq_options.keys())
            for opt_key in option_labels:
                opt_text = _sanitize_text(str(mcq_options[opt_key]))
                pdf.cell(label_width, 6, "")  # indent
                pdf.cell(0, 6, f"({opt_key}) {opt_text}", new_x="LMARGIN", new_y="NEXT")

        # Type indicator for special types
        if question_type in ("true_false",):
            pdf.set_font("Helvetica", "I", 9)
            pdf.cell(label_width, 5, "")
            pdf.cell(0, 5, "(True / False)", new_x="LMARGIN", new_y="NEXT")
        elif question_type in ("fill_in_blank",):
            pdf.set_font("Helvetica", "I", 9)
            pdf.cell(label_width, 5, "")
            pdf.cell(0, 5, "(Fill in the blank)", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(3)

    # Return PDF bytes
    return pdf.output()
