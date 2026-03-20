"""
Diagram Generation Service - Multi-renderer architecture for educational diagrams.

Uses LLM to generate structured parameters, then routes to specialized renderers
(SVG direct, Mermaid) based on subject and topic. No executable code generation --
LLM outputs structured JSON that pre-audited template functions convert to diagrams.
"""

import json
import logging
import os
import re
import uuid
import xml.etree.ElementTree as ET
from typing import Optional

from pydantic import BaseModel, Field

from .ai_service import ai_service

logger = logging.getLogger(__name__)

# Upload directory for generated diagrams
DIAGRAM_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads", "diagrams",
)

# ── Diagram Type Router ──

DIAGRAM_ROUTER: dict[tuple[str, str], str] = {
    ("Mathematics", "geometry"): "svg",
    ("Mathematics", "graph"): "svg",
    ("Mathematics", "coordinate"): "svg",
    ("Physics", "circuit"): "svg",
    ("Physics", "optics"): "svg",
    ("Physics", "force"): "svg",
    ("Biology", "lifecycle"): "mermaid",
    ("Biology", "cell"): "svg",
    ("Chemistry", "molecular"): "svg",
    ("Chemistry", "apparatus"): "svg",
}

# Fuzzy topic keywords for matching
TOPIC_KEYWORDS: dict[str, list[str]] = {
    "geometry": ["triangle", "circle", "angle", "polygon", "quadrilateral", "line", "perpendicular", "parallel", "bisector", "congruent", "similar"],
    "graph": ["graph", "plot", "function", "curve", "parabola", "linear", "quadratic", "equation"],
    "coordinate": ["coordinate", "cartesian", "axis", "origin", "midpoint", "distance", "slope"],
    "circuit": ["circuit", "resistor", "capacitor", "battery", "current", "voltage", "ohm", "series", "parallel"],
    "optics": ["lens", "mirror", "refraction", "reflection", "ray", "focal", "prism", "light"],
    "force": ["force", "newton", "friction", "gravity", "tension", "free body", "vector", "equilibrium"],
    "lifecycle": ["lifecycle", "life cycle", "cycle", "stage", "metamorphosis", "process", "flow"],
    "cell": ["cell", "nucleus", "membrane", "mitochondria", "organelle", "cytoplasm"],
    "molecular": ["molecule", "molecular", "bond", "atom", "structure", "formula", "compound"],
    "apparatus": ["apparatus", "beaker", "flask", "burner", "test tube", "experiment", "setup", "lab"],
}


# ── Pydantic Models for LLM Structured Output ──


class SVGDiagramParams(BaseModel):
    """LLM-generated structured parameters for SVG diagram rendering."""
    svg_markup: str = Field(description="Complete SVG markup string with proper viewBox, elements, labels, and accessibility attributes")
    alt_text: str = Field(description="Accessibility text description of the diagram")


class MermaidDiagramParams(BaseModel):
    """LLM-generated Mermaid syntax for flowchart/process diagrams."""
    mermaid_syntax: str = Field(description="Valid Mermaid syntax string (flowchart, sequence, etc.)")
    alt_text: str = Field(description="Accessibility text description of the diagram")


class DiagramClassification(BaseModel):
    """LLM classification of diagram type when router has no match."""
    renderer: str = Field(description="Best renderer: 'svg' or 'mermaid'")
    topic_category: str = Field(description="Topic category like 'geometry', 'circuit', 'lifecycle', etc.")


class DiagramResult(BaseModel):
    """Result from diagram generation."""
    svg_url: Optional[str] = None
    renderer_used: str
    client_params: Optional[dict] = None
    alt_text: str


# ── LLM Prompt Templates ──


SVG_SYSTEM_PROMPT = (
    "You are an expert educational diagram generator for Indian school board exams (CBSE/ICSE). "
    "You create clean, precise SVG diagrams suitable for exam papers. "
    "Diagrams must be black-and-white, clearly labeled, properly proportioned, and exam-paper style."
)

SVG_GENERATION_PROMPT = """Generate an SVG diagram for this exam question.

## Question Details
Subject: {subject}
Topic: {topic}
Question: {question_text}

## SVG Requirements
1. Use a viewBox of "0 0 400 300" (landscape) or "0 0 300 400" (portrait) as appropriate
2. Use black strokes (#000000) with stroke-width 1.5-2 for main elements
3. Use clear, readable labels with font-size 12-14px, font-family Arial/sans-serif
4. Include a <title> element with a brief diagram title
5. Include a <desc> element with a detailed description
6. Add aria-label attributes on key interactive elements
7. No decorative elements -- clean exam-paper style
8. Use dashed lines (stroke-dasharray) for construction lines or hidden edges
9. Mark angles with arcs, label measurements clearly
10. For geometry: show accurate proportions and angle marks
11. For physics: use standard symbols (arrows for forces, standard circuit symbols)
12. For biology: clear labeled parts with leader lines
13. For chemistry: proper bond representations

## Style Guidelines
- Background: none (transparent)
- Text color: #000000
- Main lines: stroke="#000000" stroke-width="2"
- Construction/guide lines: stroke="#666666" stroke-width="1" stroke-dasharray="4,4"
- Labels: font-size="13" font-family="Arial, sans-serif" fill="#000000"
- Arrowheads: use <marker> definitions for arrows

Generate ONLY the SVG markup and alt text. The SVG must be self-contained and valid."""

MERMAID_SYSTEM_PROMPT = (
    "You are an expert at creating Mermaid.js diagrams for educational content. "
    "Generate clean, well-structured Mermaid syntax for process flows, lifecycles, and flowcharts."
)

MERMAID_GENERATION_PROMPT = """Generate a Mermaid diagram for this exam question.

## Question Details
Subject: {subject}
Topic: {topic}
Question: {question_text}

## Mermaid Requirements
1. Use appropriate diagram type (flowchart TD/LR, sequence, state, etc.)
2. Use clear, concise labels (max 4-5 words per node)
3. Use proper arrow types (--> for flow, -.-> for optional, ==> for emphasis)
4. Group related nodes with subgraphs where appropriate
5. Keep the diagram readable -- max 15-20 nodes
6. Use descriptive node IDs (not A, B, C -- use meaningful names)

Generate ONLY the Mermaid syntax string and alt text."""

CLASSIFICATION_PROMPT = """Classify this exam question's diagram type.

Subject: {subject}
Topic: {topic}
Question: {question_text}

Based on the question content, determine:
1. The best renderer: 'svg' (for spatial/geometric/structural diagrams) or 'mermaid' (for process flows, lifecycles, sequences)
2. The topic category (one of: geometry, graph, coordinate, circuit, optics, force, lifecycle, cell, molecular, apparatus)

Most diagrams should use 'svg'. Only use 'mermaid' for process flows and lifecycle/sequence diagrams."""


# ── Core Service ──


class DiagramService:
    """Service for generating educational diagrams using LLM + specialized renderers."""

    def _match_topic(self, subject: str, topic: str) -> Optional[str]:
        """Fuzzy-match topic string against the router table."""
        topic_lower = topic.lower()

        # Exact match first
        for (subj, topic_key), renderer in DIAGRAM_ROUTER.items():
            if subj.lower() == subject.lower() and topic_key == topic_lower:
                return renderer

        # Fuzzy keyword match
        for topic_key, keywords in TOPIC_KEYWORDS.items():
            if any(kw in topic_lower for kw in keywords):
                router_key = (subject, topic_key)
                # Check if subject matches any entry
                for (subj, tk), renderer in DIAGRAM_ROUTER.items():
                    if subj.lower() == subject.lower() and tk == topic_key:
                        return renderer

        return None

    async def _classify_diagram_type(
        self, subject: str, topic: str, question_text: str
    ) -> tuple[str, str]:
        """Use LLM to classify the diagram type when router has no match."""
        prompt = CLASSIFICATION_PROMPT.format(
            subject=subject, topic=topic, question_text=question_text
        )

        result = await ai_service.generate_structured(
            prompt,
            DiagramClassification,
            system="You classify educational diagram types for rendering.",
            temperature=0.1,
        )

        if result:
            renderer = result.renderer if result.renderer in ("svg", "mermaid") else "svg"
            return renderer, result.topic_category

        # Default fallback
        return "svg", "general"

    def _validate_svg(self, svg_markup: str) -> bool:
        """Validate that the SVG markup is well-formed XML."""
        try:
            # Strip any leading/trailing whitespace or markdown fences
            svg_clean = svg_markup.strip()
            if svg_clean.startswith("```"):
                lines = svg_clean.split("\n")
                svg_clean = "\n".join(
                    line for line in lines
                    if not line.strip().startswith("```")
                )

            ET.fromstring(svg_clean)
            return True
        except ET.ParseError as e:
            logger.warning("SVG validation failed: %s", e)
            return False

    def _sanitize_svg(self, svg_markup: str) -> str:
        """Sanitize SVG markup to remove potentially dangerous elements."""
        svg_clean = svg_markup.strip()

        # Remove markdown code fences if present
        if svg_clean.startswith("```"):
            lines = svg_clean.split("\n")
            svg_clean = "\n".join(
                line for line in lines
                if not line.strip().startswith("```")
            )

        # Remove script tags and event handlers
        svg_clean = re.sub(r"<script[^>]*>.*?</script>", "", svg_clean, flags=re.DOTALL | re.IGNORECASE)
        svg_clean = re.sub(r'\s+on\w+\s*=\s*"[^"]*"', "", svg_clean)
        svg_clean = re.sub(r"\s+on\w+\s*=\s*'[^']*'", "", svg_clean)

        # Remove href with javascript:
        svg_clean = re.sub(r'href\s*=\s*"javascript:[^"]*"', '', svg_clean, flags=re.IGNORECASE)
        svg_clean = re.sub(r"href\s*=\s*'javascript:[^']*'", '', svg_clean, flags=re.IGNORECASE)

        return svg_clean.strip()

    def _save_svg(self, svg_markup: str) -> str:
        """Save SVG to uploads/diagrams/ and return the URL path."""
        os.makedirs(DIAGRAM_UPLOAD_DIR, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.svg"
        filepath = os.path.join(DIAGRAM_UPLOAD_DIR, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(svg_markup)

        return f"/api/uploads/diagrams/{filename}"

    async def _generate_svg(
        self, subject: str, topic: str, question_text: str
    ) -> Optional[tuple[str, str]]:
        """Generate SVG diagram via LLM. Returns (svg_markup, alt_text) or None."""
        prompt = SVG_GENERATION_PROMPT.format(
            subject=subject, topic=topic, question_text=question_text
        )

        result = await ai_service.generate_structured(
            prompt,
            SVGDiagramParams,
            system=SVG_SYSTEM_PROMPT,
            temperature=0.3,
            use_cache=False,
        )

        if not result:
            return None

        svg_markup = self._sanitize_svg(result.svg_markup)

        if not self._validate_svg(svg_markup):
            logger.warning("Generated SVG failed validation, retrying once...")
            # Retry with explicit error feedback
            retry_prompt = (
                f"{prompt}\n\n"
                "IMPORTANT: The SVG must be valid XML. Ensure all tags are properly closed, "
                "attributes are properly quoted, and special characters are escaped."
            )
            result = await ai_service.generate_structured(
                retry_prompt,
                SVGDiagramParams,
                system=SVG_SYSTEM_PROMPT,
                temperature=0.2,
                use_cache=False,
            )
            if not result:
                return None

            svg_markup = self._sanitize_svg(result.svg_markup)
            if not self._validate_svg(svg_markup):
                logger.error("SVG validation failed on retry, giving up")
                return None

        return svg_markup, result.alt_text

    async def _generate_mermaid(
        self, subject: str, topic: str, question_text: str
    ) -> Optional[tuple[str, str]]:
        """Generate Mermaid syntax via LLM. Returns (mermaid_syntax, alt_text) or None."""
        prompt = MERMAID_GENERATION_PROMPT.format(
            subject=subject, topic=topic, question_text=question_text
        )

        result = await ai_service.generate_structured(
            prompt,
            MermaidDiagramParams,
            system=MERMAID_SYSTEM_PROMPT,
            temperature=0.3,
            use_cache=False,
        )

        if not result:
            return None

        return result.mermaid_syntax.strip(), result.alt_text

    async def generate_diagram(
        self,
        question_text: str,
        subject: str,
        topic: str,
    ) -> Optional[DiagramResult]:
        """
        Generate a diagram for an exam question.

        Routes to the appropriate renderer based on subject/topic,
        falling back to LLM classification if no match is found.

        Returns DiagramResult or None if generation fails.
        """
        if not ai_service.is_available:
            logger.warning("AI service unavailable, cannot generate diagram")
            return None

        # Step 1: Route to renderer
        renderer = self._match_topic(subject, topic)

        if not renderer:
            renderer, _ = await self._classify_diagram_type(
                subject, topic, question_text
            )

        logger.info(
            "Generating diagram: subject=%s, topic=%s, renderer=%s",
            subject, topic, renderer,
        )

        # Step 2: Generate via selected renderer
        if renderer == "mermaid":
            result = await self._generate_mermaid(subject, topic, question_text)
            if not result:
                # Fallback to SVG if mermaid fails
                logger.warning("Mermaid generation failed, falling back to SVG")
                result = await self._generate_svg(subject, topic, question_text)
                if not result:
                    return None
                svg_markup, alt_text = result
                svg_url = self._save_svg(svg_markup)
                return DiagramResult(
                    svg_url=svg_url,
                    renderer_used="svg",
                    alt_text=alt_text,
                )

            mermaid_syntax, alt_text = result
            return DiagramResult(
                renderer_used="mermaid",
                client_params={"syntax": mermaid_syntax},
                alt_text=alt_text,
            )

        else:
            # SVG renderer (default)
            result = await self._generate_svg(subject, topic, question_text)
            if not result:
                return None
            svg_markup, alt_text = result
            svg_url = self._save_svg(svg_markup)
            return DiagramResult(
                svg_url=svg_url,
                renderer_used="svg",
                alt_text=alt_text,
            )


# Singleton instance
diagram_service = DiagramService()
