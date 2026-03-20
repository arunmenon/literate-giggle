# Comprehensive Research Report: Diagram Generation Alternatives for ExamIQ

## Research Summary

**Research Question**: What is the best approach for generating educational diagrams (geometry, circuits, biology, chemistry, physics) for CBSE/ICSE exam questions (Class 7-12) in the ExamIQ platform? Specifically, can LLMs generate diagrams programmatically via code instead of using image generation models like DALL-E?

**Methodology**: Multi-source evidence gathering from academic papers (arXiv, CVPR 2025, ICLR 2025, EMNLP 2025), industry benchmarks, production platform analysis (Khan Academy, Desmos, PhET), and specialized library documentation. 20+ searches conducted across technical documentation, pricing APIs, and EdTech production examples.

**Evidence Grading**: Sources are graded by evidence confidence: **[HIGH]** = peer-reviewed/independently verified, **[MEDIUM]** = preprints/platform documentation, **[LOW]** = vendor marketing/blog posts.

**Key Constraints from FR-001 Plan**: The existing plan specifies DALL-E 3 for diagram generation. However, DALL-E 3 is scheduled for deprecation on May 12, 2026. The platform uses an OpenAI client (`ai_service.py`), a React/TypeScript frontend, and a FastAPI/Python backend.

---

## 1. Evidence Analysis: LLM Code-Based Diagram Generation

### 1.1 SVG Generation by LLMs

**Strong evidence supports LLM-generated SVG as superior to image generation for educational diagrams.**

Key findings from academic research:

- **"From Text to Visuals" (AIED 2025, UMass)** [HIGH - peer-reviewed]: Tested GPT-4o generating SVG code for math educational diagrams. Achieved 80% accuracy on Visual Question Answering tasks (compared to 85% for human-created ground truth). Simple array/multiplication diagrams reached 92-100% accuracy. With in-context learning and topic-matched examples, accuracy reached 96-97%. Critically, when the same researchers tested DALL-E 3 directly for the same diagrams, they found the generated diagrams were "not useful" with only 12-14% accuracy [HIGH - peer-reviewed].

- **DiagramEval (EMNLP 2025)** [HIGH - peer-reviewed]: Benchmarked Claude 3.7 Sonnet, Gemini 2.5 Pro, and Llama 4 Maverick on SVG diagram generation. Claude performed best across 4 of 6 metrics, demonstrating that current LLMs produce structurally accurate diagrams with good text annotation.

- **SGP-GenBench & SVGenius (2025)**: Proprietary LLMs (Claude, Gemini) achieved 80-90% on compositional metrics including color binding and numeracy in SVG generation. All models degrade with increasing complexity, and reasoning-enhanced training proved more effective than pure scaling.

- **Yupp SVG Leaderboard**: Claude Opus 4.5 (Thinking) and Gemini 3 Pro ranked among top performers for SVG generation tasks.

**Cost analysis**: LLM SVG generation costs approximately $0.005-0.02 per diagram in API tokens, compared to $0.04-0.20 per image for GPT Image models. This represents a 4-40x cost reduction.

### 1.2 TikZ/LaTeX Generation

**Strong evidence for high-quality educational diagrams, but requires server-side LaTeX infrastructure.**

- LLMs are "great at LaTeX" and can generate TikZ code that produces publication-quality diagrams for geometry, physics, and chemistry.
- A specialized TikZ benchmark (EASE 2025) tested LLM code customization with visual results, finding that iterative prompting produces high-quality outputs.
- Server-side rendering solutions exist: **Texoid** (Python/Docker, renders LaTeX to SVG/PNG), **latex2image-web** (Node.js/Docker), **node-tikzjax** (renders TikZ to SVG without a full LaTeX installation -- the lightest option).
- The `tikz-optics` package provides pre-built shapes for lenses, mirrors, and optical elements directly relevant to CBSE/ICSE physics ray diagrams.
- **Trade-off**: Requires either Docker with LaTeX installation (heavy, ~2-4GB) or node-tikzjax (lighter, but limited TikZ subset). Generation time is 3-8 seconds.

### 1.3 Mermaid.js

**Good for flowcharts and process diagrams; limited for geometric/scientific diagrams.**

- Mermaid uses only 50 tokens per diagram (compared to 500 for Excalidraw JSON, 1200 for draw.io XML), making it the most token-efficient format for LLM generation [MEDIUM - developer analysis].
- LLMs generate valid Mermaid syntax reliably for flowcharts, sequence diagrams, and state diagrams.
- **Limitation**: Mermaid does not support arbitrary geometry (circles with labeled angles, ray paths, molecular structures). It is best for process flows, not spatial diagrams.
- Best suited for biology lifecycle diagrams (e.g., water cycle, carbon cycle) and chemistry process flows.

### 1.4 Manim (3Blue1Brown)

**Excellent for animated math explanations; overkill for static exam diagrams.**

- Manim produces beautiful math animations, and LLMs can generate Manim code (datasets exist for training).
- Multiple production projects exist: AutoManim, MathMatrixMovies (powered by Gemini Pro 1.5 + Manim).
- **Trade-off**: Manim is designed for video/animation, not static diagrams. It requires Python + Cairo + FFmpeg server-side. Generation time is 10-30 seconds per animation. For static exam question diagrams, simpler approaches (SVG, TikZ) are faster and more appropriate.

### 1.5 Matplotlib/Plotly (Server-Side Python)

**Reliable for graphs and function plots; good for coordinate geometry and data visualization.**

- Matplotlib produces publication-quality mathematical graphs with precise axis labels, gridlines, and annotations. LLMs can generate Matplotlib code reliably.
- Server-side rendering is straightforward: generate Python code, execute it, save to PNG/SVG.
- Plotly adds interactivity but requires JavaScript runtime on client.
- Best for: function graphs (y=mx+b, parabolas, trigonometric functions), coordinate geometry, statistical charts.

---

## 2. Evidence Analysis: Specialized Diagram Libraries for Education

### 2.1 GeoGebra (Interactive Geometry)

**The gold standard for interactive geometry in education.**

- Full JavaScript API (`deployggb.js`) enables programmatic diagram creation via `ggbApplet.evalCommand()`.
- Commands like `Point("A", 2, 3)`, `Circle(A, 3)`, `Line(A, B)` create geometry constructions programmatically.
- An LLM can generate GeoGebra command sequences, which the frontend renders via the embedded GeoGebra applet.
- **Advantages**: Mathematically precise (exact angles, exact intersections), interactive (students can drag points), widely used in CBSE/ICSE education.
- **Limitations**: ~200KB library footprint; requires API key from desmos.com; constructions are interactive (may need to be locked for exam context); limited to geometry and function plotting.
- **Free** under educational license.

### 2.2 JSXGraph (Lightweight Interactive Geometry)

**Excellent lightweight alternative to GeoGebra for web embedding.**

- ~200KB, no dependencies, runs on SVG/Canvas/VML.
- Purpose-built for teaching, learning, and assessment of interactive geometry.
- Simple API: `board.create('point', [2, 3], {name: 'A'})`.
- Supports: points, lines, circles, polygons, function plots, sliders, parametric curves.
- **Free** under MIT/LGPL dual license.
- **Advantage over GeoGebra**: Lighter footprint, simpler API, better suited for embedding in exam platforms.

### 2.3 Desmos API (Mathematical Graphs)

**Best-in-class for function graphing and algebraic visualization.**

- Full JavaScript API with `setExpression({latex: 'y=x^2'})` for programmatic graph creation.
- Supports 2D and 3D graphing, sliders, tables, and regression.
- LaTeX input is parsed into AST, then compiled to JavaScript/GLSL.
- Khan Academy rebuilt their graphing exercises using **Mafs** (a React library inspired by Desmos-like interactive math).
- **Requires API key** from desmos.com/my-api. Free for educational use.

### 2.4 Mafs (React Interactive Math)

**Production-proven React library used by Khan Academy.**

- Declarative React components for math visualization: `<Mafs><Circle center={[0,0]} radius={3} /></Mafs>`.
- Khan Academy uses Mafs for all their graphing exercises, with full accessibility support (keyboard navigation, screen readers).
- Supports: coordinate planes, points, lines, circles, polygons, function plots, vectors, parametric curves.
- ~50KB, well-tested with visual regression testing.
- **Best fit for ExamIQ's React frontend** since it is a native React component library.

### 2.5 Penrose (CMU Declarative Diagrams)

**Academically impressive but not production-ready for ExamIQ.**

- Translates mathematical notation to diagrams via constraint-based optimization.
- Three-file system (Domain, Substance, Style) is powerful but complex.
- Active development (Penrose 3.0 released), but the learning curve and tooling maturity make it unsuitable for a production exam platform in the near term.

### 2.6 Chemistry-Specific Libraries

- **RDKit.js**: Official JavaScript distribution for cheminformatics. Renders molecular structures as SVG/Canvas from SMILES notation. Ideal for chemistry structural formulas.
- **Kekule.js**: Open-source JavaScript chemoinformatics toolkit (MIT license). Supports drawing, editing, and rendering molecular structures.
- **3Dmol.js**: WebGL-based 3D molecular visualization. Supports PDB, SDF, MOL2 formats.

### 2.7 Circuit Diagram Libraries

- **SchemDraw** (Python): Generates high-quality circuit schematics as SVG/PNG. LLMs can generate SchemDraw code; a LinkedIn post from 2025 demonstrates "Automating Circuit Diagrams with Claude Code" using SchemDraw [LOW - blog post].
- **SimcirJS**: HTML5/JavaScript circuit simulator with interactive drag-and-drop.
- **Syncfusion Diagram Library**: Comprehensive JavaScript diagramming with digital logic gates and circuit components.

---

## 3. Evidence Analysis: AI Image Generation Models

### 3.1 DALL-E 3 / GPT Image Models

**Critical finding: DALL-E 3 is being deprecated May 12, 2026.**

- OpenAI recommends migrating to GPT Image 1 or GPT Image 1.5.
- GPT Image 1.5 costs $0.009-0.20 per image depending on quality/resolution.
- GPT-4o (and successors) improved text rendering to ~92% accuracy for short phrases.
- **For educational diagrams specifically**: When tested for geometry diagrams, DALL-E 3 produced diagrams that were "not useful" (12-14% accuracy in the UMass study). Image generation models fundamentally struggle with precise geometry because they work in pixel space, not coordinate space.
- **Text garbling remains a problem**: Labels with more than 3-5 words often contain errors.
- **Not editable**: Output is raster (PNG/JPEG), not vector. Cannot be modified after generation.

### 3.2 Stable Diffusion / Midjourney

- Both are worse than DALL-E for educational diagrams.
- Midjourney "struggled with text generation" making it unsuitable for labeled diagrams.
- Stable Diffusion can be fine-tuned for specific diagram types, but requires significant ML infrastructure.
- Neither offers APIs suitable for automated educational diagram generation.

### 3.3 Conclusion on Image Generation Models

**Image generation models are the wrong tool for educational diagrams.** They generate approximate visual representations in pixel space. Educational diagrams require mathematical precision (exact angles, correct proportions, readable labels) that only code-based approaches can guarantee. Multiple independent research papers confirm this finding.

---

## 4. Evidence Analysis: Hybrid Approaches

### 4.1 LLM -> Structured Code -> Deterministic Renderer (RECOMMENDED)

The strongest pattern emerging from research and production use:

1. **LLM generates structured parameters** (not raw pixels): angle values, point coordinates, component lists, function expressions.
2. **Specialized renderer** produces the diagram deterministically: JSXGraph for geometry, SchemDraw for circuits, Matplotlib for graphs, RDKit for molecules.
3. **Output is vector (SVG)**: scalable, editable, accessible, small file size.

**DiagrammerGPT (COLM 2024)** validates this approach: it uses an LLM to generate "diagram plans" (entities, relationships, bounding boxes), then a specialized renderer produces the actual diagram. It significantly outperformed direct image generation.

### 4.2 Template-Based with LLM Parameter Filling

For common CBSE/ICSE diagram types, pre-build parameterized templates:

```
Template: "Triangle with labeled vertices and one marked angle"
Parameters: { vertices: ["A", "B", "C"], angle_at: "B", angle_value: 90, sides: [3, 4, 5] }
```

The LLM extracts parameters from the question text; the template engine renders the diagram. This is the most reliable approach for common diagram types and eliminates hallucination entirely for the rendering step.

### 4.3 Production Examples

- **Khan Academy**: Uses SVG for math diagrams, Mafs (React) for interactive geometry. LLM-generated SVGs are being explored for hint diagrams.
- **PhET (University of Colorado)**: HTML5 Canvas with hand-coded simulations. Not using LLM generation.
- **Brilliant.org**: Custom interactive visualizations, likely SVG-based.
- **GeoGebra**: Used by millions of CBSE/ICSE students; provides programmatic API.

---

## 5. Subject-Specific Best Approach Matrix

Based on the evidence gathered, here are the recommended approaches for each diagram type needed in CBSE/ICSE exams:

| Subject | Diagram Type | Best Approach | Rationale | Fallback |
|---------|-------------|---------------|-----------|----------|
| **Mathematics** | Geometry figures (triangles, circles, angles) | **LLM -> JSXGraph/Mafs** (code generation) | Mathematically precise, interactive, editable. LLM generates construction commands. | LLM -> SVG direct |
| **Mathematics** | Graphs/functions (y=mx+b, parabolas) | **LLM -> Desmos API or Mafs** | Purpose-built for function plotting. LLM provides LaTeX expression. | LLM -> Matplotlib -> SVG |
| **Mathematics** | Coordinate geometry | **LLM -> Mafs** (React native) | Declarative React components. Best integration with ExamIQ frontend. | LLM -> JSXGraph |
| **Physics** | Circuit diagrams | **LLM -> SchemDraw** (Python, server-side) | Standard electrical symbols, LLM generates SchemDraw code, exports SVG. | LLM -> SVG direct with templates |
| **Physics** | Ray diagrams (optics) | **LLM -> TikZ (tikz-optics)** via node-tikzjax | Pre-built optics shapes (lenses, mirrors). LLM generates TikZ code. | LLM -> SVG with templates |
| **Physics** | Force diagrams / Free body diagrams | **LLM -> SVG direct** or **LLM -> Mafs** | Relatively simple (arrows + labels). LLMs generate clean SVG for these. | Template-based SVG |
| **Biology** | Cell diagrams, organ cross-sections | **LLM -> SVG direct + Template library** | Complex labeled diagrams benefit from curated SVG templates. LLM fills labels/annotations. | GPT Image 1 Mini (for artistic detail) |
| **Biology** | Lifecycle / process diagrams | **LLM -> Mermaid.js** | Flowchart-style diagrams are Mermaid's strength. Ultra-efficient (50 tokens). | LLM -> SVG |
| **Chemistry** | Molecular structures | **LLM -> RDKit.js** (from SMILES string) | Industry-standard chemical rendering. LLM generates SMILES notation. | LLM -> SVG |
| **Chemistry** | Lab apparatus setup | **LLM -> SVG + Template library** | Standardized lab equipment shapes as SVG templates. LLM composes layout. | GPT Image 1 Mini |
| **Chemistry** | Electrolysis / reaction diagrams | **LLM -> SVG direct** | Labeled diagrams with arrows and annotations. SVG handles well. | Mermaid.js for process flow |
| **Geography** | Maps, landforms | **GPT Image 1 Mini** (only case for image gen) | Maps require artistic rendering that code-based approaches handle poorly. | Pre-made SVG map templates |

---

## 6. Cost and Performance Comparison (Updated for 2026)

| Approach | Cost per Diagram | Generation Time | Quality for Education | Editability | Infrastructure |
|----------|-----------------|-----------------|----------------------|-------------|---------------|
| **GPT Image 1.5 (High)** | $0.19 | 5-15s | Low for geometry (12-14%), OK for biology | None (raster) | OpenAI API only |
| **GPT Image 1 Mini (Low)** | $0.005 | 3-8s | Low-Medium | None (raster) | OpenAI API only |
| **LLM -> SVG direct** | ~$0.01 | 2-5s | High (80%+ for math) | Full (vector, XML) | None additional |
| **LLM -> Mafs (React)** | ~$0.01 | 1-3s | Excellent for geometry | Full (interactive) | npm package (~50KB) |
| **LLM -> JSXGraph** | ~$0.01 | 1-3s | Excellent for geometry | Full (interactive) | JS library (~200KB) |
| **LLM -> TikZ -> SVG** | ~$0.01 | 3-8s | Publication quality | Full (source code) | node-tikzjax or Docker+LaTeX |
| **LLM -> Mermaid** | ~$0.005 | 1-3s | Good for flowcharts | Full (source code) | npm package (~1MB) |
| **LLM -> SchemDraw** | ~$0.01 | 2-5s | Excellent for circuits | Full (SVG) | Python package |
| **LLM -> RDKit.js** | ~$0.01 | 1-3s | Excellent for molecules | Full (interactive) | WASM module (~10MB) |
| **LLM -> Matplotlib** | ~$0.01 | 2-5s | Excellent for graphs | Moderate (regenerate) | Python + matplotlib |
| **Desmos API** | Free | <1s | Best for functions | Full (interactive) | JS library + API key |
| **GeoGebra API** | Free (edu) | <1s | Best for geometry | Full (interactive) | JS library (~1MB) |

---

## 7. Recommendations for ExamIQ

### Primary Recommendation: Multi-Renderer Architecture with LLM Code Generation

**Confidence Level: HIGH** (supported by academic research, production examples, and cost analysis)

Instead of a single diagram generation approach, implement a **diagram type router** that selects the optimal renderer based on subject and diagram type:

```
Question Text -> LLM (Claude/GPT) -> Structured Output (JSON) -> Diagram Type Router -> Specialized Renderer -> SVG/Interactive Component
```

**Router logic (v1):** Static subject+topic mapping table, with LLM classification as fallback.

```python
DIAGRAM_ROUTER = {
    ('Mathematics', 'geometry'): 'mafs',
    ('Mathematics', 'graph'): 'mafs',
    ('Mathematics', 'coordinate'): 'mafs',
    ('Physics', 'circuit'): 'schemdraw',
    ('Physics', 'optics'): 'tikz',
    ('Physics', 'force'): 'svg',
    ('Biology', 'lifecycle'): 'mermaid',
    ('Biology', 'cell'): 'svg_template',
    ('Chemistry', 'molecular'): 'svg_template',  # Phase 3: rdkit
    ('Chemistry', 'apparatus'): 'svg_template',
}
# Fallback: LLM classifies diagram type from question text
```

The router checks subject + fuzzy topic match first. If no match, a lightweight LLM call classifies the diagram type.

### Recommended Architecture

**Primary geometry renderer: Mafs.** Mafs is React-native (matches ExamIQ's stack), ~50KB, used by Khan Academy, and has built-in accessibility support. JSXGraph (~200KB, framework-agnostic) is the fallback for edge cases Mafs can't handle (parametric curves, advanced sliders). For v1, use Mafs exclusively.

**Phase 1 (Replace DALL-E in FR-001 Plan)**:
1. **LLM -> SVG Direct Generation** for general-purpose diagrams. Use Claude or GPT to generate SVG markup directly. This covers 60-70% of diagram needs immediately.
2. **Mafs** for interactive geometry on the frontend (React-native, used by Khan Academy, ~50KB).
3. **Mermaid.js** for process/lifecycle diagrams (already widely supported, ultra-efficient).

**Phase 2 (Subject-Specific Renderers)**:
4. **SchemDraw** (Python, server-side) for circuit diagrams.
5. **Matplotlib** (Python, server-side) for function graphs and coordinate geometry.

**Phase 3 (Advanced)**:
6. **RDKit.js** (WASM, client-side) for molecular structures from SMILES notation. RDKit.js (~10MB WASM) is too heavy for Phase 2. For CBSE Class 7-12 chemistry, molecular structures needed are relatively simple (water, methane, ethanol, benzene). LLM -> SVG direct with template assistance handles these. RDKit.js is Phase 3 for advanced organic chemistry (Class 11-12).
7. **Template library** of curated SVG diagrams for common CBSE/ICSE patterns (cell diagrams, organ systems, lab apparatus).
8. **GPT Image 1 Mini** ($0.005/image) as a fallback ONLY for complex artistic diagrams (geography maps, detailed biological illustrations) where code-based approaches are insufficient.

**Security model for server-side renderers:** The LLM does NOT generate executable Python code. Instead, the LLM generates structured parameters (JSON) and a fixed, pre-audited template function fills those parameters into the renderer API. Example: LLM outputs `{"components": [{"type": "resistor", "value": "10kΩ", "from": "A", "to": "B"}]}`, and the template function calls `d += elm.Resistor().label('10kΩ')`. This eliminates code injection risk entirely.

### Why NOT DALL-E/Image Generation as Primary

1. **Deprecation**: DALL-E 3 is deprecated May 12, 2026. The FR-001 plan references DALL-E 3 specifically.
2. **Accuracy**: 12-14% accuracy for geometry diagrams (UMass AIED 2025 study) vs 80%+ for LLM-generated SVG.
3. **Cost**: 4-40x more expensive per diagram than code-based approaches.
4. **Editability**: Raster output cannot be edited, zoomed without quality loss, or made accessible.
5. **Labels**: Text in AI-generated images remains unreliable beyond 3-5 words.
6. **Determinism**: Same prompt produces different images each time. Code-based rendering is deterministic.

### Implementation Impact on FR-001

The existing FR-001 plan should be updated as follows:

- **Phase 2 (Task 2.1)**: Replace `ai_service.generate_image()` (DALL-E) with a `diagram_generator.py` service that routes to appropriate code-generation backends.
- **Phase 2 (Task 2.2)**: The `DiagramGenerator` service should accept `{ question_text, subject, topic, diagram_type }` and return `{ svg_code, renderer_used, parameters }` instead of an image URL.
- **Phase 2 (Task 2.5)**: Frontend renders SVG inline (or uses Mafs/JSXGraph for interactive geometry) instead of displaying a raster image.
- **Phase 2 Cost Model**: Remove DALL-E rate limiting/daily caps (unnecessary at $0.01/diagram). Add LLM token tracking instead.

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| LLM generates invalid SVG | Validate SVG server-side before returning; retry with error feedback |
| Complex biology diagrams beyond LLM SVG capability | Maintain curated template library; fall back to GPT Image 1 Mini |
| JSXGraph/Mafs learning curve for team | Both have excellent documentation; Khan Academy open-sourced Mafs examples |
| Multiple renderers increase complexity | Abstract behind a single `DiagramService` interface; start with SVG-only, add renderers incrementally |

### Accessibility Requirements

**Accessibility requirements for SVG diagrams:** All generated SVGs must include: (a) `<title>` element with diagram description for screen readers, (b) `<desc>` element with detailed alt-text, (c) `aria-label` on interactive elements, (d) sufficient color contrast (WCAG AA). The LLM should generate alt-text alongside SVG code. Mafs is strong here -- Khan Academy specifically rebuilt their graphing for accessibility. For students who cannot interpret visual diagrams, generate a text description as an alternative representation.

### Future Monitoring

- Track Claude and GPT SVG generation quality improvements (improving rapidly quarter-over-quarter)
- Monitor OmniSVG and LLM4SVG research models for potential open-source alternatives
- Watch for Desmos/GeoGebra AI integration features
- Evaluate Penrose when it reaches production maturity

---

## Knowledge Gaps and Areas for Further Investigation

1. **RDKit.js WASM bundle size**: At ~10MB, this may need lazy-loading strategy similar to Excalidraw
2. **node-tikzjax subset limitations**: Not all TikZ packages are supported; need to validate tikz-optics compatibility
3. **Mafs vs JSXGraph detailed comparison**: Both are viable for geometry; a practical prototype with CBSE geometry questions would determine the better fit
4. **CBSE/ICSE specific diagram corpus**: No benchmark dataset exists for Indian education board diagram types; creating one would enable quality measurement

---

## Sources

- [From Text to Visuals: Using LLMs to Generate Math Diagrams with Vector Graphics (AIED 2025)](https://arxiv.org/html/2503.07429v1)
- [DiagramEval: Evaluating LLM-Generated Diagrams via Graphs (EMNLP 2025)](https://arxiv.org/html/2510.25761v1)
- [LLM SVG Generation Benchmark (Simon Willison)](https://simonwillison.net/2025/Nov/25/llm-svg-generation-benchmark/)
- [AI Model Drawing Capabilities Showdown: SVG Generation Benchmark of 9 Top LLMs](https://www.communeify.com/en/blog/ai-image-generation-showdown-9-llms-svg-benchmark/)
- [SVGenius: Benchmarking LLMs in SVG Understanding, Editing and Generation](https://arxiv.org/html/2506.03139v1)
- [Empowering LLMs to Understand and Generate Complex Vector Graphics (CVPR 2025)](https://openaccess.thecvf.com/content/CVPR2025/papers/Xing_Empowering_LLMs_to_Understand_and_Generate_Complex_Vector_Graphics_CVPR_2025_paper.pdf)
- [DiagrammerGPT: LLM-Driven Diagram Automation (COLM 2024)](https://diagrammergpt.github.io/)
- [Analyzing the Best Diagramming Tools for the LLM Age Based on Token Efficiency](https://dev.to/akari_iku/analyzing-the-best-diagramming-tools-for-the-llm-age-based-on-token-efficiency-5891)
- [Diagrams as Code: Supercharged by AI Assistants](https://simmering.dev/blog/diagrams/)
- [How to Create Software Diagrams With ChatGPT and Claude](https://thenewstack.io/how-to-create-software-diagrams-with-chatgpt-and-claude/)
- [Build Interactive Diagram Tools with Claude](https://claude.com/resources/use-cases/build-interactive-diagram-tools)
- [Excalidraw MCP Server: LLM Diagram API](https://mcpmarket.com/server/excalidraw-1)
- [LaTeX, LLMs and Boring Technology](https://eli.thegreenplace.net/2025/latex-llms-and-boring-technology/)
- [LLM Code Customization with Visual Results: A Benchmark on TikZ (EASE 2025)](https://dl.acm.org/doi/full/10.1145/3756681.3757003)
- [MermaidSeqBench: Evaluation Benchmark for LLM-to-Mermaid Generation](https://arxiv.org/html/2511.14967v1)
- [GeoGebra JavaScript API](https://deepwiki.com/geogebra/integration/3.1-javascript-api)
- [JSXGraph: Cross-browser Library for Interactive Geometry](https://jsxgraph.org/home/)
- [Mafs: React Components for Interactive Math](https://mafs.dev/)
- [Rebuilding Graphs for Accessibility: Khan Academy's Inclusive Design](https://blog.khanacademy.org/rebuilding-graphs-for-accessibility-inside-khan-academys-inclusive-designrebuilding-graphs-for-accessibility-inside-khan-academys-inclusive-design/)
- [Desmos API v1.11 Documentation](https://www.desmos.com/api)
- [RDKit.js: JavaScript Cheminformatics](https://www.rdkitjs.com/)
- [Kekule.js: JavaScript Chemoinformatics Toolkit](https://partridgejiang.github.io/Kekule.js/)
- [3Dmol.js: Molecular Visualization](https://3dmol.csb.pitt.edu/)
- [SchemDraw: Python Circuit Schematic Diagrams](https://schemdraw.readthedocs.io/)
- [Automating Circuit Diagrams with Claude Code (LinkedIn)](https://www.linkedin.com/posts/danmccreary_schemdraw-circuit-generator-circuits-1-activity-7423198046684934144-ZJG_)
- [Texoid: Lightweight Python LaTeX-to-SVG Server](https://github.com/DMOJ/texoid)
- [node-tikzjax: TikZ to SVG without LaTeX Installation](https://www.npmjs.com/package/node-tikzjax)
- [OpenAI DALL-E & GPT Image Pricing (March 2026)](https://costgoat.com/pricing/openai-images)
- [OpenAI Deprecations: DALL-E 3 to May 12, 2026](https://developers.openai.com/api/docs/deprecations)
- [GPT-4o vs DALL-E: Text in AI Image Generation](https://opace.agency/blog/chatgpt-image-generation-gpt-4o-vs-dall-e-3-and-others)
- [CBSE Class 10 Science Important Diagrams 2025](https://www.educart.co/news/important-diagrams-for-class-10-science)
- [ICSE Class 10 Biology Expected Questions & Diagrams 2026](https://www.aakash.ac.in/blog/icse-class-10-biology-question-paper-2026-expected-questions-diagrams/)
- [PhET Interactive Simulations](https://phet.colorado.edu/)
- [ConceptViz: AI Diagram Generator for Education](https://conceptviz.app/)
- [TikZ Optics Package](https://github.com/fruchart/tikz-optics)
- [Penrose: CMU Declarative Diagram Language](https://penrose.cs.cmu.edu/)

---

**Relevant files in the ExamIQ codebase**:
- `/Users/arunmenon/literate-giggle/.claude/tasks/fr001-diagram-support.md` -- The existing FR-001 plan that should be updated based on this research
- `/Users/arunmenon/literate-giggle/backend/app/services/ai_service.py` -- The AI service that currently wraps OpenAI API and would need the diagram generation logic
- `/Users/arunmenon/literate-giggle/backend/app/services/evaluation_engine.py` -- Evaluation engine that routes diagram questions
- `/Users/arunmenon/literate-giggle/backend/app/models/exam.py` -- Contains `QuestionType.DIAGRAM` enum and image URL fields
