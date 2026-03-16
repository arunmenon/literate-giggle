"""
Seed script for curriculum data.

Populates Board, Curriculum, Subject, Chapter, Topic, LearningOutcome,
and QuestionPattern tables with real CBSE/ICSE syllabus data based on
NCERT textbooks and official board exam patterns.

Idempotent: checks for existing records before inserting.
"""

import asyncio
from sqlalchemy import select
from app.core.database import init_db, async_session
from app.models.curriculum import (
    Board, Curriculum, CurriculumSubject, CurriculumChapter,
    CurriculumTopic, LearningOutcome, QuestionPattern,
)


CBSE_BOARD_PATTERN_2025 = (
    "50% competency-based for 2024-25 (MCQs, case-based, assertion-reasoning). "
    "30% constructed response. 20% traditional. "
    "Internal choice in all sections. Case-study based questions mandatory."
)


# ─────────────────────────────────────────────────────────────────────────────
# CBSE Class 10 Mathematics -- All 14 NCERT Chapters (Ch 15 removed from 2024-25)
# ─────────────────────────────────────────────────────────────────────────────

CBSE_MATH_10_CHAPTERS = [
    {
        "number": 1,
        "name": "Real Numbers",
        "textbook_reference": "NCERT Ch. 1",
        "marks_weightage": 6,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Euclid's Division Lemma", "Statement and application of Euclid's division lemma to find HCF"),
            ("Fundamental Theorem of Arithmetic", "Every composite number can be expressed as a product of primes uniquely"),
            ("Irrational Numbers", "Proving irrationality of sqrt(2), sqrt(3), sqrt(5) by contradiction"),
            ("Rational Numbers and Decimal Expansions", "Terminating and non-terminating recurring decimal expansions"),
            ("HCF and LCM using Prime Factorization", "Finding HCF and LCM using fundamental theorem"),
        ],
        "learning_outcomes": [
            ("LO-M10-01-01", "Apply Euclid's division algorithm to find HCF of two positive integers", "apply", "procedural"),
            ("LO-M10-01-02", "Use Fundamental Theorem of Arithmetic to find HCF and LCM", "apply", "procedural"),
            ("LO-M10-01-03", "Prove irrationality of sqrt(2), sqrt(3), sqrt(5) using proof by contradiction", "analyze", "reasoning"),
            ("LO-M10-01-04", "Determine whether rational numbers have terminating or non-terminating decimal expansions", "understand", "conceptual"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "MCQ on HCF/LCM, prime factorization", "If HCF(306, 657) = 9, find LCM(306, 657).", "2024"),
            ("short_answer", 2, "high", "Prove irrationality or find HCF/LCM", "Prove that sqrt(5) is irrational.", "2023"),
            ("short_answer", 3, "medium", "Application-based word problems", "Find the largest number which divides 245 and 1029 leaving remainder 5 in each case.", "2023"),
            ("case_study", 4, "medium", "Competency-based case study on real-world HCF/LCM", None, "2024"),
        ],
    },
    {
        "number": 2,
        "name": "Polynomials",
        "textbook_reference": "NCERT Ch. 2",
        "marks_weightage": 7,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Zeroes of a Polynomial", "Finding zeroes and verifying using factor theorem"),
            ("Relationship between Zeroes and Coefficients", "Sum and product of zeroes for quadratic polynomials"),
            ("Division Algorithm for Polynomials", "Dividing polynomials and verifying the division algorithm"),
            ("Quadratic Polynomials", "Standard form, discriminant, nature of zeroes"),
            ("Geometrical Meaning of Zeroes", "Graphical interpretation of zeroes as x-intercepts"),
        ],
        "learning_outcomes": [
            ("LO-M10-02-01", "Find zeroes of quadratic polynomials and verify the relationship", "apply", "procedural"),
            ("LO-M10-02-02", "Relate zeroes to coefficients (sum = -b/a, product = c/a)", "understand", "conceptual"),
            ("LO-M10-02-03", "Apply division algorithm for polynomials", "apply", "procedural"),
            ("LO-M10-02-04", "Interpret geometric meaning of zeroes from graphs", "understand", "visual-spatial"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "Sum/product of zeroes given polynomial", "If the sum of zeroes of p(x) = 2x^2 - 5x + k is 5/2, find k.", "2023"),
            ("short_answer", 2, "high", "Find zeroes and verify relationship", None, "2023"),
            ("short_answer", 3, "medium", "Division algorithm application", None, "2024"),
            ("case_study", 4, "low", "Graph-based competency question on zeroes", None, "2024"),
        ],
    },
    {
        "number": 3,
        "name": "Pair of Linear Equations in Two Variables",
        "textbook_reference": "NCERT Ch. 3",
        "marks_weightage": 8,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Graphical Method of Solution", "Solving by plotting lines and finding intersection"),
            ("Substitution Method", "Solving by expressing one variable in terms of another"),
            ("Elimination Method", "Solving by eliminating one variable through addition/subtraction"),
            ("Cross-Multiplication Method", "Using cross-multiplication formula"),
            ("Consistency of System of Equations", "Conditions for unique, infinite, or no solutions"),
            ("Word Problems on Linear Equations", "Translating real-world problems into linear equations"),
        ],
        "learning_outcomes": [
            ("LO-M10-03-01", "Solve pairs of linear equations by graphical and algebraic methods", "apply", "procedural"),
            ("LO-M10-03-02", "Determine consistency of a system using ratio conditions (a1/a2, b1/b2, c1/c2)", "analyze", "reasoning"),
            ("LO-M10-03-03", "Formulate linear equations from word problems", "apply", "problem-solving"),
            ("LO-M10-03-04", "Interpret graphical solutions (intersecting, parallel, coincident lines)", "understand", "visual-spatial"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "Consistency condition MCQs", "For what value of k, the system 3x+y=1, (2k-1)x+(k-1)y=2k+1 has no solution?", "2023"),
            ("short_answer", 3, "high", "Solve system by elimination/substitution", None, "2024"),
            ("long_answer", 5, "medium", "Word problem requiring system of equations", None, "2023"),
            ("case_study", 4, "medium", "Real-life scenario with linear equations", None, "2024"),
        ],
    },
    {
        "number": 4,
        "name": "Quadratic Equations",
        "textbook_reference": "NCERT Ch. 4",
        "marks_weightage": 8,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Standard Form of Quadratic Equations", "ax^2 + bx + c = 0, identifying coefficients"),
            ("Solution by Factorization", "Splitting middle term method"),
            ("Solution by Completing the Square", "Converting to perfect square form"),
            ("Quadratic Formula", "x = (-b +/- sqrt(b^2-4ac)) / 2a"),
            ("Nature of Roots", "Discriminant D = b^2-4ac and its implications"),
            ("Word Problems on Quadratic Equations", "Speed, area, age problems leading to quadratics"),
        ],
        "learning_outcomes": [
            ("LO-M10-04-01", "Solve quadratic equations by factorization", "apply", "procedural"),
            ("LO-M10-04-02", "Apply quadratic formula to find roots", "apply", "procedural"),
            ("LO-M10-04-03", "Determine nature of roots using discriminant", "analyze", "reasoning"),
            ("LO-M10-04-04", "Formulate quadratic equations from word problems", "apply", "problem-solving"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "Nature of roots, discriminant", "If discriminant of ax^2+bx+c=0 is zero, the roots are:", "2023"),
            ("short_answer", 2, "high", "Solve by factorization", "Find roots of x^2 - 7x + 12 = 0.", "2024"),
            ("short_answer", 3, "high", "Find k for given root condition", None, "2023"),
            ("long_answer", 5, "medium", "Word problem leading to quadratic", None, "2024"),
        ],
    },
    {
        "number": 5,
        "name": "Arithmetic Progressions",
        "textbook_reference": "NCERT Ch. 5",
        "marks_weightage": 8,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Introduction to AP", "Definition, common difference, general term"),
            ("nth Term of an AP", "a_n = a + (n-1)d"),
            ("Sum of First n Terms", "S_n = n/2 [2a + (n-1)d] or S_n = n/2 (a + l)"),
            ("Applications of AP", "Real-world problems involving AP patterns"),
        ],
        "learning_outcomes": [
            ("LO-M10-05-01", "Identify arithmetic progressions and find common difference", "understand", "conceptual"),
            ("LO-M10-05-02", "Find nth term and sum of first n terms of an AP", "apply", "procedural"),
            ("LO-M10-05-03", "Solve real-world problems using AP formulas", "apply", "problem-solving"),
            ("LO-M10-05-04", "Determine whether a given sequence is an AP", "analyze", "reasoning"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "Common difference, nth term", "The nth term of an AP is 3n+5. The common difference is:", "2023"),
            ("short_answer", 3, "high", "Find sum of n terms", "Find the sum of first 20 terms of AP 2, 7, 12, 17...", "2024"),
            ("short_answer", 2, "medium", "Find number of terms given sum", None, "2023"),
            ("long_answer", 5, "medium", "Word problem on AP", None, "2024"),
        ],
    },
    {
        "number": 6,
        "name": "Triangles",
        "textbook_reference": "NCERT Ch. 6",
        "marks_weightage": 8,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Similar Triangles", "Definition and criteria for similarity"),
            ("Basic Proportionality Theorem (Thales)", "If a line is drawn parallel to one side, it divides the other two proportionally"),
            ("Criteria for Similarity (AA, SSS, SAS)", "Proving triangles similar"),
            ("Areas of Similar Triangles", "Ratio of areas equals square of ratio of corresponding sides"),
            ("Pythagoras Theorem", "Proof and applications"),
            ("Converse of Pythagoras Theorem", "If sum of squares of two sides equals square of third"),
        ],
        "learning_outcomes": [
            ("LO-M10-06-01", "Apply BPT (Thales' theorem) and its converse", "apply", "reasoning"),
            ("LO-M10-06-02", "Prove triangles similar using AA, SSS, SAS criteria", "analyze", "reasoning"),
            ("LO-M10-06-03", "Calculate ratios of areas of similar triangles", "apply", "procedural"),
            ("LO-M10-06-04", "Prove and apply Pythagoras theorem", "apply", "reasoning"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "Similarity criteria, BPT", None, "2024"),
            ("short_answer", 3, "high", "Prove similarity or apply BPT", None, "2023"),
            ("long_answer", 5, "medium", "Prove Pythagoras theorem or applications", None, "2024"),
            ("case_study", 4, "medium", "Real-world similarity problem", None, "2024"),
        ],
    },
    {
        "number": 7,
        "name": "Coordinate Geometry",
        "textbook_reference": "NCERT Ch. 7",
        "marks_weightage": 6,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Distance Formula", "Distance between two points in coordinate plane"),
            ("Section Formula", "Internal division of a line segment in given ratio"),
            ("Mid-Point Formula", "Special case of section formula"),
            ("Area of Triangle", "Area using coordinates of vertices"),
            ("Collinearity of Points", "Condition for three points to be collinear"),
        ],
        "learning_outcomes": [
            ("LO-M10-07-01", "Calculate distance between two points using distance formula", "apply", "procedural"),
            ("LO-M10-07-02", "Find coordinates of point dividing a segment in given ratio", "apply", "procedural"),
            ("LO-M10-07-03", "Compute area of triangle given vertices", "apply", "procedural"),
            ("LO-M10-07-04", "Verify collinearity using area method", "analyze", "reasoning"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "Distance formula, section formula", "Distance between (3,4) and (8,-3) is:", "2023"),
            ("short_answer", 2, "high", "Find mid-point or section point", None, "2024"),
            ("numerical", 3, "high", "Area of triangle using coordinates", "Find area of triangle with vertices (1,-1), (-4,6), (-3,-5).", "2023"),
            ("case_study", 4, "low", "Map/grid-based coordinate geometry", None, "2024"),
        ],
    },
    {
        "number": 8,
        "name": "Introduction to Trigonometry",
        "textbook_reference": "NCERT Ch. 8",
        "marks_weightage": 8,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Trigonometric Ratios", "sin, cos, tan, cosec, sec, cot for acute angles"),
            ("Trigonometric Ratios of Specific Angles", "Values at 0, 30, 45, 60, 90 degrees"),
            ("Trigonometric Identities", "sin^2 + cos^2 = 1, 1 + tan^2 = sec^2, 1 + cot^2 = cosec^2"),
            ("Complementary Angles", "sin(90-A) = cosA, etc."),
        ],
        "learning_outcomes": [
            ("LO-M10-08-01", "Calculate trigonometric ratios of acute angles in right triangles", "apply", "procedural"),
            ("LO-M10-08-02", "Use standard angle values (0/30/45/60/90) in calculations", "apply", "procedural"),
            ("LO-M10-08-03", "Prove trigonometric identities", "analyze", "reasoning"),
            ("LO-M10-08-04", "Apply complementary angle relations", "apply", "conceptual"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "Evaluate trig expressions", "If tan θ = 12/5, find (sin θ + cos θ) x sec θ:", "2023"),
            ("short_answer", 2, "high", "Prove trig identity", None, "2024"),
            ("short_answer", 3, "high", "Evaluate compound trig expressions", None, "2023"),
            ("long_answer", 5, "medium", "Multi-step identity proof", None, "2024"),
        ],
    },
    {
        "number": 9,
        "name": "Some Applications of Trigonometry",
        "textbook_reference": "NCERT Ch. 9",
        "marks_weightage": 6,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Heights and Distances", "Finding heights/distances using trigonometric ratios"),
            ("Angle of Elevation", "Angle above horizontal from observer to object"),
            ("Angle of Depression", "Angle below horizontal from observer to object"),
            ("Two-Object Problems", "Problems involving two objects and angle relations"),
        ],
        "learning_outcomes": [
            ("LO-M10-09-01", "Calculate height of an object using angle of elevation", "apply", "problem-solving"),
            ("LO-M10-09-02", "Find distance using angle of depression", "apply", "problem-solving"),
            ("LO-M10-09-03", "Solve problems involving two angles (elevation and depression)", "analyze", "problem-solving"),
            ("LO-M10-09-04", "Draw and interpret diagrams for height/distance problems", "understand", "visual-spatial"),
        ],
        "question_patterns": [
            ("long_answer", 5, "high", "Height and distance problem with two angles", "From the top of a 7m building, angle of elevation to tower top is 60° and depression to foot is 45°. Find tower height.", "2023"),
            ("short_answer", 3, "high", "Single angle elevation/depression problem", None, "2024"),
            ("case_study", 4, "medium", "Real-world trigonometry application", None, "2024"),
        ],
    },
    {
        "number": 10,
        "name": "Circles",
        "textbook_reference": "NCERT Ch. 10",
        "marks_weightage": 4,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Tangent to a Circle", "Definition and properties of tangents"),
            ("Number of Tangents from External Point", "Two tangents from an external point are equal"),
            ("Tangent-Radius Relationship", "Tangent is perpendicular to radius at point of contact"),
            ("Theorems on Tangents", "Proofs involving tangent properties"),
        ],
        "learning_outcomes": [
            ("LO-M10-10-01", "Prove that tangent is perpendicular to radius", "analyze", "reasoning"),
            ("LO-M10-10-02", "Prove tangents from external point are equal", "analyze", "reasoning"),
            ("LO-M10-10-03", "Apply tangent properties in problem solving", "apply", "problem-solving"),
        ],
        "question_patterns": [
            ("mcq", 1, "medium", "Tangent properties", None, "2024"),
            ("short_answer", 3, "high", "Prove tangent theorem and apply", None, "2023"),
            ("long_answer", 5, "medium", "Multi-step proof involving tangent", None, "2024"),
        ],
    },
    {
        "number": 11,
        "name": "Areas Related to Circles",
        "textbook_reference": "NCERT Ch. 11",
        "marks_weightage": 4,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Area of Circle", "A = pi*r^2"),
            ("Area of Sector", "A = (theta/360) * pi*r^2"),
            ("Area of Segment", "Area of sector - area of triangle"),
            ("Length of Arc", "L = (theta/360) * 2*pi*r"),
            ("Combination of Figures", "Shaded region problems combining shapes"),
        ],
        "learning_outcomes": [
            ("LO-M10-11-01", "Calculate area of sector and segment", "apply", "procedural"),
            ("LO-M10-11-02", "Find length of arc given angle", "apply", "procedural"),
            ("LO-M10-11-03", "Solve composite figure area problems", "analyze", "problem-solving"),
        ],
        "question_patterns": [
            ("mcq", 1, "medium", "Area/arc length formulas", None, "2024"),
            ("short_answer", 3, "high", "Find area of shaded region", None, "2023"),
            ("numerical", 3, "medium", "Composite figure calculation", None, "2024"),
        ],
    },
    {
        "number": 12,
        "name": "Surface Areas and Volumes",
        "textbook_reference": "NCERT Ch. 12",
        "marks_weightage": 6,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Combination of Solids", "Surface area/volume of combined shapes"),
            ("Conversion of Solids", "Melting/reshaping one solid into another"),
            ("Frustum of a Cone", "Volume and surface area of frustum"),
            ("Surface Area and Volume Formulas", "Cylinder, cone, sphere, hemisphere formulas"),
        ],
        "learning_outcomes": [
            ("LO-M10-12-01", "Calculate surface area of combination of solids", "apply", "procedural"),
            ("LO-M10-12-02", "Calculate volume when one solid is converted to another", "apply", "problem-solving"),
            ("LO-M10-12-03", "Find volume and surface area of frustum of a cone", "apply", "procedural"),
        ],
        "question_patterns": [
            ("mcq", 1, "medium", "Volume/SA formulas", None, "2024"),
            ("short_answer", 3, "high", "Conversion of solids problem", "A cone of height 24cm and radius 6cm is reshaped into a sphere. Find radius.", "2023"),
            ("long_answer", 5, "medium", "Combination of solids problem", None, "2024"),
            ("case_study", 4, "medium", "Real-world solid geometry", None, "2024"),
        ],
    },
    {
        "number": 13,
        "name": "Statistics",
        "textbook_reference": "NCERT Ch. 13",
        "marks_weightage": 8,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Mean of Grouped Data", "Direct, assumed mean, and step-deviation methods"),
            ("Median of Grouped Data", "Using cumulative frequency and formula"),
            ("Mode of Grouped Data", "Using mode formula for grouped data"),
            ("Ogive (Cumulative Frequency Curve)", "Graphical representation and median from ogive"),
        ],
        "learning_outcomes": [
            ("LO-M10-13-01", "Calculate mean using all three methods", "apply", "procedural"),
            ("LO-M10-13-02", "Find median of grouped data using formula", "apply", "procedural"),
            ("LO-M10-13-03", "Calculate mode of grouped data", "apply", "procedural"),
            ("LO-M10-13-04", "Draw and interpret ogives to find median", "apply", "visual-spatial"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "Identify correct method/formula", None, "2024"),
            ("short_answer", 3, "high", "Calculate mean/median/mode from frequency table", None, "2023"),
            ("long_answer", 5, "high", "Full calculation with ogive/cumulative frequency", None, "2024"),
            ("case_study", 4, "medium", "Data interpretation with statistics", None, "2024"),
        ],
    },
    {
        "number": 14,
        "name": "Probability",
        "textbook_reference": "NCERT Ch. 14",
        "marks_weightage": 5,
        "question_pattern_notes": CBSE_BOARD_PATTERN_2025,
        "topics": [
            ("Classical Definition of Probability", "P(E) = favorable outcomes / total outcomes"),
            ("Complementary Events", "P(E) + P(not E) = 1"),
            ("Elementary Events", "Events with single outcome"),
            ("Problems on Coins, Dice, Cards", "Standard probability problems"),
        ],
        "learning_outcomes": [
            ("LO-M10-14-01", "Calculate probability of events using classical definition", "apply", "procedural"),
            ("LO-M10-14-02", "Use complementary events to find probability", "apply", "procedural"),
            ("LO-M10-14-03", "Solve problems involving cards, coins, and dice", "apply", "problem-solving"),
        ],
        "question_patterns": [
            ("mcq", 1, "high", "Basic probability calculation", "Probability of getting a bad egg in a lot of 400 is 0.035. Number of bad eggs:", "2023"),
            ("short_answer", 2, "high", "Card/dice probability problem", None, "2024"),
            ("short_answer", 3, "medium", "Application-based probability", None, "2023"),
            ("case_study", 4, "medium", "Real-world data probability", None, "2024"),
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# CBSE Class 10 Science -- 13 chapters
# ─────────────────────────────────────────────────────────────────────────────

CBSE_SCIENCE_10_CHAPTERS = [
    {
        "number": 1, "name": "Chemical Reactions and Equations",
        "textbook_reference": "NCERT Ch. 1", "marks_weightage": 5,
        "topics": [
            ("Chemical Equations", "Writing and balancing chemical equations"),
            ("Types of Chemical Reactions", "Combination, decomposition, displacement, double displacement, redox"),
            ("Effects of Oxidation in Daily Life", "Corrosion, rancidity"),
        ],
        "learning_outcomes": [
            ("LO-S10-01-01", "Write and balance chemical equations", "apply", "procedural"),
            ("LO-S10-01-02", "Classify types of chemical reactions", "understand", "conceptual"),
        ],
    },
    {
        "number": 2, "name": "Acids, Bases and Salts",
        "textbook_reference": "NCERT Ch. 2", "marks_weightage": 5,
        "topics": [
            ("Properties of Acids and Bases", "Physical and chemical properties"),
            ("pH Scale", "Measuring acidity and basicity"),
            ("Salts", "Preparation and properties of common salts"),
            ("Neutralization", "Acid-base reactions producing salt and water"),
        ],
        "learning_outcomes": [
            ("LO-S10-02-01", "Identify acids and bases using indicators", "understand", "conceptual"),
            ("LO-S10-02-02", "Explain pH scale and its applications", "understand", "conceptual"),
        ],
    },
    {
        "number": 3, "name": "Metals and Non-metals",
        "textbook_reference": "NCERT Ch. 3", "marks_weightage": 5,
        "topics": [
            ("Physical Properties of Metals and Non-metals", "Malleability, ductility, conductivity"),
            ("Chemical Properties of Metals", "Reactions with oxygen, water, acids"),
            ("Reactivity Series", "Arrangement based on reactivity"),
            ("Extraction of Metals", "Roasting, calcination, electrolysis"),
            ("Corrosion and Prevention", "Rusting and methods to prevent it"),
        ],
        "learning_outcomes": [
            ("LO-S10-03-01", "Distinguish metals and non-metals by physical and chemical properties", "understand", "conceptual"),
            ("LO-S10-03-02", "Explain extraction methods for different metals", "understand", "procedural"),
        ],
    },
    {
        "number": 4, "name": "Carbon and its Compounds",
        "textbook_reference": "NCERT Ch. 4", "marks_weightage": 5,
        "topics": [
            ("Bonding in Carbon", "Covalent bonding, versatile nature of carbon"),
            ("Saturated and Unsaturated Hydrocarbons", "Alkanes, alkenes, alkynes"),
            ("Functional Groups", "Alcohols, aldehydes, ketones, carboxylic acids"),
            ("Nomenclature", "IUPAC naming of carbon compounds"),
            ("Chemical Properties", "Combustion, oxidation, substitution, addition"),
        ],
        "learning_outcomes": [
            ("LO-S10-04-01", "Explain covalent bonding in carbon compounds", "understand", "conceptual"),
            ("LO-S10-04-02", "Name carbon compounds using IUPAC nomenclature", "apply", "procedural"),
        ],
    },
    {
        "number": 5, "name": "Life Processes",
        "textbook_reference": "NCERT Ch. 5", "marks_weightage": 7,
        "topics": [
            ("Nutrition", "Autotrophic (photosynthesis) and heterotrophic nutrition"),
            ("Respiration", "Aerobic and anaerobic respiration"),
            ("Transportation", "Blood circulation, heart, blood vessels"),
            ("Excretion", "Nephron function, urine formation"),
        ],
        "learning_outcomes": [
            ("LO-S10-05-01", "Describe the process of photosynthesis", "understand", "conceptual"),
            ("LO-S10-05-02", "Explain double circulation in human heart", "understand", "conceptual"),
            ("LO-S10-05-03", "Describe excretory system function", "understand", "conceptual"),
        ],
    },
    {
        "number": 6, "name": "Control and Coordination",
        "textbook_reference": "NCERT Ch. 6", "marks_weightage": 5,
        "topics": [
            ("Nervous System", "Brain, spinal cord, reflex arc"),
            ("Coordination in Plants", "Tropic and nastic movements"),
            ("Hormones", "Animal and plant hormones"),
        ],
        "learning_outcomes": [
            ("LO-S10-06-01", "Describe the structure and function of the nervous system", "understand", "conceptual"),
            ("LO-S10-06-02", "Explain coordination in plants through hormones", "understand", "conceptual"),
        ],
    },
    {
        "number": 7, "name": "How do Organisms Reproduce?",
        "textbook_reference": "NCERT Ch. 7", "marks_weightage": 5,
        "topics": [
            ("Asexual Reproduction", "Fission, budding, regeneration, fragmentation, spore formation"),
            ("Sexual Reproduction in Plants", "Pollination, fertilization, seed formation"),
            ("Sexual Reproduction in Humans", "Male and female reproductive systems"),
            ("Reproductive Health", "Contraception, STDs"),
        ],
        "learning_outcomes": [
            ("LO-S10-07-01", "Compare asexual and sexual reproduction", "analyze", "conceptual"),
            ("LO-S10-07-02", "Describe human reproductive systems", "understand", "conceptual"),
        ],
    },
    {
        "number": 8, "name": "Heredity and Evolution",
        "textbook_reference": "NCERT Ch. 8", "marks_weightage": 5,
        "topics": [
            ("Mendel's Laws", "Law of dominance, segregation, independent assortment"),
            ("Sex Determination", "Chromosomal basis of sex determination"),
            ("Evolution", "Evidence, speciation, natural selection"),
        ],
        "learning_outcomes": [
            ("LO-S10-08-01", "Apply Mendel's laws to predict genetic outcomes", "apply", "reasoning"),
            ("LO-S10-08-02", "Explain chromosomal sex determination", "understand", "conceptual"),
        ],
    },
    {
        "number": 9, "name": "Light - Reflection and Refraction",
        "textbook_reference": "NCERT Ch. 9", "marks_weightage": 7,
        "topics": [
            ("Reflection by Mirrors", "Laws of reflection, image formation by concave/convex mirrors"),
            ("Mirror Formula", "1/v + 1/u = 1/f, magnification"),
            ("Refraction of Light", "Laws of refraction, Snell's law"),
            ("Lens Formula", "1/v - 1/u = 1/f for thin lenses"),
            ("Power of a Lens", "P = 1/f in diopters"),
        ],
        "learning_outcomes": [
            ("LO-S10-09-01", "Apply mirror and lens formulae", "apply", "procedural"),
            ("LO-S10-09-02", "Draw ray diagrams for image formation", "apply", "visual-spatial"),
            ("LO-S10-09-03", "Calculate magnification and power of lens", "apply", "procedural"),
        ],
    },
    {
        "number": 10, "name": "The Human Eye and the Colourful World",
        "textbook_reference": "NCERT Ch. 10", "marks_weightage": 3,
        "topics": [
            ("Human Eye", "Structure, accommodation, defects of vision"),
            ("Defects of Vision", "Myopia, hypermetropia, presbyopia"),
            ("Prism and Dispersion", "Refraction through prism, spectrum"),
            ("Atmospheric Refraction", "Twinkling of stars, early sunrise"),
            ("Scattering of Light", "Tyndall effect, why sky is blue"),
        ],
        "learning_outcomes": [
            ("LO-S10-10-01", "Explain the working of human eye and its defects", "understand", "conceptual"),
            ("LO-S10-10-02", "Describe dispersion and scattering of light", "understand", "conceptual"),
        ],
    },
    {
        "number": 11, "name": "Electricity",
        "textbook_reference": "NCERT Ch. 11", "marks_weightage": 7,
        "topics": [
            ("Electric Current and Circuit", "Current, potential difference, circuit diagrams"),
            ("Ohm's Law", "V = IR, V-I characteristics"),
            ("Resistance", "Factors affecting resistance, resistivity"),
            ("Combination of Resistors", "Series and parallel combinations"),
            ("Heating Effect of Current", "Joule's law, electrical power and energy"),
        ],
        "learning_outcomes": [
            ("LO-S10-11-01", "Apply Ohm's law in circuit calculations", "apply", "procedural"),
            ("LO-S10-11-02", "Calculate equivalent resistance in series and parallel", "apply", "procedural"),
            ("LO-S10-11-03", "Compute electrical power and energy consumption", "apply", "procedural"),
        ],
    },
    {
        "number": 12, "name": "Magnetic Effects of Electric Current",
        "textbook_reference": "NCERT Ch. 12", "marks_weightage": 5,
        "topics": [
            ("Magnetic Field", "Magnetic field lines, compass needle deflection"),
            ("Electromagnetic Induction", "Faraday's experiments, AC generator"),
            ("Electric Motor", "Principle and working"),
            ("Domestic Electric Circuits", "Fuse, earthing, safety"),
        ],
        "learning_outcomes": [
            ("LO-S10-12-01", "Describe magnetic field patterns around conductors", "understand", "conceptual"),
            ("LO-S10-12-02", "Explain electromagnetic induction and its applications", "understand", "conceptual"),
        ],
    },
    {
        "number": 13, "name": "Our Environment",
        "textbook_reference": "NCERT Ch. 13", "marks_weightage": 3,
        "topics": [
            ("Ecosystem", "Components, food chains, food webs"),
            ("Environmental Problems", "Ozone depletion, waste management"),
            ("Biodegradable and Non-biodegradable Waste", "Classification and management"),
        ],
        "learning_outcomes": [
            ("LO-S10-13-01", "Explain ecosystem components and energy flow", "understand", "conceptual"),
            ("LO-S10-13-02", "Discuss environmental problems and solutions", "analyze", "conceptual"),
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# ICSE Class 10 Mathematics -- Key chapters with Selina references
# ─────────────────────────────────────────────────────────────────────────────

ICSE_MATH_10_CHAPTERS = [
    {
        "number": 1, "name": "GST (Goods and Services Tax)",
        "textbook_reference": "Selina Ch. 1", "marks_weightage": 5,
        "topics": [
            ("GST Concepts", "CGST, SGST, IGST computation"),
            ("GST on Purchases and Sales", "Input tax credit, tax calculation"),
        ],
        "learning_outcomes": [
            ("LO-IM10-01-01", "Calculate GST on purchase and sale transactions", "apply", "procedural"),
        ],
    },
    {
        "number": 2, "name": "Banking",
        "textbook_reference": "Selina Ch. 2", "marks_weightage": 5,
        "topics": [
            ("Recurring Deposit", "Monthly installment, maturity value formula"),
            ("Fixed Deposit", "Simple and compound interest"),
        ],
        "learning_outcomes": [
            ("LO-IM10-02-01", "Calculate maturity value of recurring and fixed deposits", "apply", "procedural"),
        ],
    },
    {
        "number": 3, "name": "Shares and Dividends",
        "textbook_reference": "Selina Ch. 3", "marks_weightage": 5,
        "topics": [
            ("Shares", "Nominal value, market value, dividend"),
            ("Return on Investment", "Calculating percentage return"),
        ],
        "learning_outcomes": [
            ("LO-IM10-03-01", "Calculate dividend income and return on investment", "apply", "procedural"),
        ],
    },
    {
        "number": 4, "name": "Linear Inequations",
        "textbook_reference": "Selina Ch. 4", "marks_weightage": 5,
        "topics": [
            ("Linear Inequations in One Variable", "Solving and graphing on number line"),
            ("Solution Set", "Representing solutions on number line"),
        ],
        "learning_outcomes": [
            ("LO-IM10-04-01", "Solve linear inequations and represent on number line", "apply", "procedural"),
        ],
    },
    {
        "number": 5, "name": "Quadratic Equations",
        "textbook_reference": "Selina Ch. 5", "marks_weightage": 6,
        "topics": [
            ("Solving Quadratic Equations", "Factorization and formula method"),
            ("Nature of Roots", "Discriminant analysis"),
            ("Word Problems", "Age, speed, area problems"),
        ],
        "learning_outcomes": [
            ("LO-IM10-05-01", "Solve quadratic equations by various methods", "apply", "procedural"),
            ("LO-IM10-05-02", "Determine nature of roots using discriminant", "analyze", "reasoning"),
        ],
    },
    {
        "number": 6, "name": "Ratio and Proportion",
        "textbook_reference": "Selina Ch. 6", "marks_weightage": 5,
        "topics": [
            ("Componendo and Dividendo", "Transformation of ratios"),
            ("Continued Proportion", "Mean proportional"),
        ],
        "learning_outcomes": [
            ("LO-IM10-06-01", "Apply componendo-dividendo and continued proportion", "apply", "procedural"),
        ],
    },
    {
        "number": 7, "name": "Factorization of Polynomials",
        "textbook_reference": "Selina Ch. 7", "marks_weightage": 5,
        "topics": [
            ("Factor Theorem", "f(a) = 0 implies (x-a) is a factor"),
            ("Remainder Theorem", "Finding remainder without division"),
        ],
        "learning_outcomes": [
            ("LO-IM10-07-01", "Apply factor and remainder theorems", "apply", "procedural"),
        ],
    },
    {
        "number": 8, "name": "Matrices",
        "textbook_reference": "Selina Ch. 8", "marks_weightage": 5,
        "topics": [
            ("Matrix Operations", "Addition, subtraction, multiplication"),
            ("Solving Equations using Matrices", "2x2 systems"),
        ],
        "learning_outcomes": [
            ("LO-IM10-08-01", "Perform matrix operations and solve linear systems", "apply", "procedural"),
        ],
    },
    {
        "number": 9, "name": "Arithmetic and Geometric Progression",
        "textbook_reference": "Selina Ch. 9", "marks_weightage": 6,
        "topics": [
            ("Arithmetic Progression", "General term, sum of n terms"),
            ("Geometric Progression", "General term, sum of n terms, applications"),
        ],
        "learning_outcomes": [
            ("LO-IM10-09-01", "Find nth term and sum of AP and GP", "apply", "procedural"),
        ],
    },
    {
        "number": 10, "name": "Coordinate Geometry",
        "textbook_reference": "Selina Ch. 10", "marks_weightage": 6,
        "topics": [
            ("Section and Mid-point Formula", "Internal division, mid-point"),
            ("Equation of a Line", "Slope-intercept, point-slope forms"),
            ("Slope of a Line", "Parallel and perpendicular line conditions"),
        ],
        "learning_outcomes": [
            ("LO-IM10-10-01", "Find equation of a line given conditions", "apply", "procedural"),
            ("LO-IM10-10-02", "Apply section formula and mid-point formula", "apply", "procedural"),
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# CBSE Class 10 English
# ─────────────────────────────────────────────────────────────────────────────

CBSE_ENGLISH_10_CHAPTERS = [
    {
        "number": 1, "name": "Reading Comprehension",
        "textbook_reference": "NCERT First Flight / Footprints",
        "marks_weightage": 20,
        "topics": [
            ("Unseen Passage", "Comprehension of factual and discursive passages"),
            ("Case-based Passage", "Data interpretation and inference from case-based text"),
        ],
    },
    {
        "number": 2, "name": "Writing",
        "textbook_reference": "NCERT English Communicative",
        "marks_weightage": 20,
        "topics": [
            ("Letter Writing", "Formal and informal letters"),
            ("Story Writing", "Narrative composition from given prompts"),
            ("Article Writing", "Analytical and persuasive writing"),
        ],
    },
    {
        "number": 3, "name": "Grammar",
        "textbook_reference": "NCERT English Grammar",
        "marks_weightage": 20,
        "topics": [
            ("Tenses", "Correct use of tenses in context"),
            ("Voice", "Active and passive voice transformations"),
            ("Reported Speech", "Direct to indirect speech conversion"),
            ("Conditionals", "If-clauses and conditional sentences"),
            ("Nouns", "Plurals, collective nouns, abstract nouns"),
        ],
    },
    {
        "number": 4, "name": "Literature",
        "textbook_reference": "NCERT First Flight / Footprints without Feet",
        "marks_weightage": 20,
        "topics": [
            ("Prose", "Short stories and prose passages"),
            ("Poetry", "Poems and poetic devices"),
            ("Figures of Speech", "Simile, metaphor, personification, alliteration"),
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# CBSE Class 10 Social Studies
# ─────────────────────────────────────────────────────────────────────────────

CBSE_SST_10_CHAPTERS = [
    {
        "number": 1, "name": "History",
        "textbook_reference": "NCERT India and the Contemporary World II",
        "marks_weightage": 20,
        "topics": [
            ("Nationalism in India", "Rise of nationalism, Civil Disobedience Movement"),
            ("French Revolution", "Causes, course, and impact"),
            ("Industrial Revolution", "Changes in industry and society"),
        ],
    },
    {
        "number": 2, "name": "Geography",
        "textbook_reference": "NCERT Contemporary India II",
        "marks_weightage": 20,
        "topics": [
            ("Resources and Development", "Types and conservation of resources"),
            ("Soil Types", "Classification and distribution of soils"),
            ("Water Resources", "Conservation and management"),
        ],
    },
    {
        "number": 3, "name": "Civics",
        "textbook_reference": "NCERT Democratic Politics II",
        "marks_weightage": 20,
        "topics": [
            ("Federalism", "Federal structure and division of powers"),
            ("Democracy and Diversity", "Social divisions and politics"),
            ("Political Parties", "Role and types of political parties"),
        ],
    },
    {
        "number": 4, "name": "Economics",
        "textbook_reference": "NCERT Understanding Economic Development",
        "marks_weightage": 20,
        "topics": [
            ("Development", "GDP, income, and development indicators"),
            ("Sectors of Economy", "Primary, secondary, tertiary sectors"),
            ("Money and Credit", "Banking and financial institutions"),
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# CBSE Class 9 Mathematics
# ─────────────────────────────────────────────────────────────────────────────

CBSE_MATH_9_CHAPTERS = [
    {
        "number": 1, "name": "Number Systems",
        "textbook_reference": "NCERT Ch. 1",
        "marks_weightage": 8,
        "topics": [
            ("Rational Numbers", "Properties and representation on number line"),
            ("Irrational Numbers", "Identifying and locating irrational numbers"),
            ("Real Numbers", "Decimal expansions and operations"),
        ],
    },
    {
        "number": 2, "name": "Polynomials",
        "textbook_reference": "NCERT Ch. 2",
        "marks_weightage": 8,
        "topics": [
            ("Polynomials in One Variable", "Degree, coefficients, zeroes"),
            ("Factorisation", "Factor theorem and factorisation techniques"),
        ],
    },
    {
        "number": 3, "name": "Coordinate Geometry",
        "textbook_reference": "NCERT Ch. 3",
        "marks_weightage": 4,
        "topics": [
            ("Cartesian System", "Plotting points and identifying quadrants"),
        ],
    },
    {
        "number": 4, "name": "Linear Equations in Two Variables",
        "textbook_reference": "NCERT Ch. 4",
        "marks_weightage": 8,
        "topics": [
            ("Linear Equations", "Solution of linear equations in two variables"),
        ],
    },
    {
        "number": 5, "name": "Triangles",
        "textbook_reference": "NCERT Ch. 7",
        "marks_weightage": 12,
        "topics": [
            ("Congruence of Triangles", "SSS, SAS, ASA, AAS, RHS criteria"),
            ("Properties of Triangles", "Angle sum, exterior angle, inequalities"),
        ],
    },
    {
        "number": 6, "name": "Heron's Formula",
        "textbook_reference": "NCERT Ch. 12",
        "marks_weightage": 8,
        "topics": [
            ("Area of Triangle", "Heron's formula for scalene triangles"),
            ("Application", "Area of quadrilaterals using Heron's formula"),
        ],
    },
    {
        "number": 7, "name": "Quadrilaterals",
        "textbook_reference": "NCERT Ch. 8",
        "marks_weightage": 8,
        "topics": [
            ("Properties of Quadrilaterals", "Parallelogram, rhombus, rectangle, square"),
        ],
    },
    {
        "number": 8, "name": "Circles",
        "textbook_reference": "NCERT Ch. 10",
        "marks_weightage": 8,
        "topics": [
            ("Properties of Circles", "Chords, arcs, angles subtended"),
        ],
    },
    {
        "number": 9, "name": "Statistics",
        "textbook_reference": "NCERT Ch. 14",
        "marks_weightage": 8,
        "topics": [
            ("Collection and Presentation", "Frequency distributions, histograms, bar graphs"),
            ("Measures of Central Tendency", "Mean, median, mode"),
        ],
    },
    {
        "number": 10, "name": "Probability",
        "textbook_reference": "NCERT Ch. 15",
        "marks_weightage": 8,
        "topics": [
            ("Experimental Probability", "Empirical probability from experiments"),
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# CBSE Class 8 Science
# ─────────────────────────────────────────────────────────────────────────────

CBSE_SCIENCE_8_CHAPTERS = [
    {
        "number": 1, "name": "Crop Production and Management",
        "textbook_reference": "NCERT Ch. 1",
        "marks_weightage": 5,
        "topics": [("Agricultural Practices", "Preparation of soil, sowing, irrigation")],
    },
    {
        "number": 2, "name": "Microorganisms",
        "textbook_reference": "NCERT Ch. 2",
        "marks_weightage": 6,
        "topics": [
            ("Friendly Microorganisms", "Use of microorganisms in food and medicine"),
            ("Harmful Microorganisms", "Disease-causing microorganisms, food preservation"),
        ],
    },
    {
        "number": 3, "name": "Synthetic Fibres and Plastics",
        "textbook_reference": "NCERT Ch. 3",
        "marks_weightage": 5,
        "topics": [
            ("Synthetic Fibres", "Types -- nylon, polyester, acrylic"),
            ("Plastics", "Thermoplastics and thermosetting plastics"),
        ],
    },
    {
        "number": 4, "name": "Materials: Metals and Non-metals",
        "textbook_reference": "NCERT Ch. 4",
        "marks_weightage": 5,
        "topics": [("Properties", "Physical and chemical properties of metals and non-metals")],
    },
    {
        "number": 5, "name": "Coal and Petroleum",
        "textbook_reference": "NCERT Ch. 5",
        "marks_weightage": 5,
        "topics": [("Fossil Fuels", "Formation, extraction, and conservation")],
    },
    {
        "number": 6, "name": "Combustion and Flame",
        "textbook_reference": "NCERT Ch. 6",
        "marks_weightage": 6,
        "topics": [
            ("Combustion", "Types of combustion, ignition temperature"),
            ("Flame", "Structure and zones of flame"),
        ],
    },
    {
        "number": 7, "name": "Conservation of Plants and Animals",
        "textbook_reference": "NCERT Ch. 7",
        "marks_weightage": 5,
        "topics": [("Biodiversity", "Deforestation, conservation, biosphere reserves")],
    },
    {
        "number": 8, "name": "Cell - Structure and Functions",
        "textbook_reference": "NCERT Ch. 8",
        "marks_weightage": 5,
        "topics": [("Cell Biology", "Cell organelles, plant and animal cells")],
    },
    {
        "number": 9, "name": "Reproduction in Animals",
        "textbook_reference": "NCERT Ch. 9",
        "marks_weightage": 5,
        "topics": [("Reproduction", "Sexual and asexual reproduction in animals")],
    },
    {
        "number": 10, "name": "Force and Pressure",
        "textbook_reference": "NCERT Ch. 11",
        "marks_weightage": 6,
        "topics": [
            ("Force", "Contact and non-contact forces"),
            ("Pressure", "Pressure in fluids, atmospheric pressure"),
        ],
    },
    {
        "number": 11, "name": "Friction",
        "textbook_reference": "NCERT Ch. 12",
        "marks_weightage": 5,
        "topics": [("Friction", "Types, factors affecting, and reducing friction")],
    },
    {
        "number": 12, "name": "Sound",
        "textbook_reference": "NCERT Ch. 13",
        "marks_weightage": 5,
        "topics": [("Sound Production", "Vibration, frequency, amplitude, loudness")],
    },
    {
        "number": 13, "name": "Chemical Effects of Electric Current",
        "textbook_reference": "NCERT Ch. 14",
        "marks_weightage": 5,
        "topics": [("Electroplating", "Electrolysis and its applications")],
    },
    {
        "number": 14, "name": "Light",
        "textbook_reference": "NCERT Ch. 16",
        "marks_weightage": 5,
        "topics": [("Reflection", "Laws of reflection, mirrors, dispersion")],
    },
    {
        "number": 15, "name": "Stars and the Solar System",
        "textbook_reference": "NCERT Ch. 17",
        "marks_weightage": 5,
        "topics": [("Astronomy", "Stars, planets, constellations, satellites")],
    },
    {
        "number": 16, "name": "Pollution of Air and Water",
        "textbook_reference": "NCERT Ch. 18",
        "marks_weightage": 5,
        "topics": [("Pollution", "Causes, effects, and prevention of air and water pollution")],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# ICSE Class 10 English
# ─────────────────────────────────────────────────────────────────────────────

ICSE_ENGLISH_10_CHAPTERS = [
    {
        "number": 1, "name": "Literature",
        "textbook_reference": "Treasure Trove",
        "marks_weightage": 30,
        "topics": [
            ("Poetry", "Poems from Treasure Trove with analysis"),
            ("Prose", "Short stories from Treasure Trove"),
            ("Shakespeare", "Merchant of Venice / select play"),
        ],
    },
    {
        "number": 2, "name": "Writing",
        "textbook_reference": "Total English",
        "marks_weightage": 25,
        "topics": [
            ("Composition", "Essay and narrative writing"),
            ("Letter Writing", "Formal and informal letters"),
            ("Notice and Email", "Formal notices and email writing"),
        ],
    },
    {
        "number": 3, "name": "Grammar",
        "textbook_reference": "Total English",
        "marks_weightage": 25,
        "topics": [
            ("Transformation", "Sentence transformation and rewriting"),
            ("Correction", "Error correction in sentences"),
            ("Vocabulary", "Synonyms, antonyms, phrasal verbs"),
        ],
    },
    {
        "number": 4, "name": "Comprehension",
        "textbook_reference": "Total English",
        "marks_weightage": 20,
        "topics": [
            ("Unseen Passage", "Reading comprehension and inference"),
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Additional ICSE Class 10 Math chapters (Sets, Mensuration, Statistics)
# ─────────────────────────────────────────────────────────────────────────────

ICSE_MATH_10_EXTRA_CHAPTERS = [
    {
        "number": 11, "name": "Sets",
        "textbook_reference": "Selina Ch. 11",
        "marks_weightage": 5,
        "topics": [
            ("Set Operations", "Union, intersection, complement, difference"),
            ("Venn Diagrams", "Representation of sets using Venn diagrams"),
        ],
    },
    {
        "number": 12, "name": "Statistics",
        "textbook_reference": "Selina Ch. 12",
        "marks_weightage": 5,
        "topics": [
            ("Measures of Central Tendency", "Mean, median, mode of grouped data"),
            ("Graphical Representation", "Histograms, ogives, frequency polygons"),
        ],
    },
    {
        "number": 13, "name": "Mensuration",
        "textbook_reference": "Selina Ch. 13",
        "marks_weightage": 8,
        "topics": [
            ("Surface Area", "Cylinder, cone, sphere surface areas"),
            ("Volume", "Volume of solids and combined shapes"),
        ],
    },
]


async def seed_curriculum():
    """Seed curriculum data. Idempotent -- checks before inserting."""
    await init_db()

    async with async_session() as db:
        # ─── Boards ───
        boards_data = [
            ("CBSE", "Central Board of Secondary Education", "National board under Ministry of Education, India"),
            ("ICSE", "Indian Certificate of Secondary Education", "Board managed by CISCE, focus on analytical skills"),
            ("State Board", "State Board of Education", "Various state-level education boards across India"),
        ]
        board_records = {}
        for code, name, description in boards_data:
            existing = await db.execute(select(Board).where(Board.code == code))
            board = existing.scalar_one_or_none()
            if not board:
                board = Board(code=code, name=name, description=description)
                db.add(board)
                await db.flush()
            board_records[code] = board

        # ─── Curricula (academic year 2025-26) ───
        curricula = {}
        for board_code, board_obj in board_records.items():
            existing = await db.execute(
                select(Curriculum).where(
                    Curriculum.board_id == board_obj.id,
                    Curriculum.academic_year == "2025-26",
                )
            )
            curriculum = existing.scalar_one_or_none()
            if not curriculum:
                curriculum = Curriculum(
                    board_id=board_obj.id, academic_year="2025-26", is_active=True
                )
                db.add(curriculum)
                await db.flush()
            curricula[board_code] = curriculum

        # ─── CBSE Math Class 10 ───
        await _seed_subject(
            db, curricula["CBSE"],
            code="MATH", name="Mathematics", class_grade=10,
            textbook_name="NCERT Mathematics Class 10",
            total_marks=80,
            chapters=CBSE_MATH_10_CHAPTERS,
        )

        # ─── CBSE Science Class 10 ───
        await _seed_subject(
            db, curricula["CBSE"],
            code="SCI", name="Science", class_grade=10,
            textbook_name="NCERT Science Class 10",
            total_marks=80,
            chapters=CBSE_SCIENCE_10_CHAPTERS,
        )

        # ─── ICSE Math Class 10 ───
        await _seed_subject(
            db, curricula["ICSE"],
            code="MATH", name="Mathematics", class_grade=10,
            textbook_name="Selina Concise Mathematics Class 10",
            total_marks=80,
            chapters=ICSE_MATH_10_CHAPTERS,
        )

        # ─── CBSE English Class 10 ───
        await _seed_subject(
            db, curricula["CBSE"],
            code="ENG", name="English", class_grade=10,
            textbook_name="NCERT English Class 10",
            total_marks=80,
            chapters=CBSE_ENGLISH_10_CHAPTERS,
        )

        # ─── CBSE Social Studies Class 10 ───
        await _seed_subject(
            db, curricula["CBSE"],
            code="SST", name="Social Studies", class_grade=10,
            textbook_name="NCERT Social Studies Class 10",
            total_marks=80,
            chapters=CBSE_SST_10_CHAPTERS,
        )

        # ─── CBSE Math Class 9 ───
        await _seed_subject(
            db, curricula["CBSE"],
            code="MATH", name="Mathematics", class_grade=9,
            textbook_name="NCERT Mathematics Class 9",
            total_marks=80,
            chapters=CBSE_MATH_9_CHAPTERS,
        )

        # ─── CBSE Science Class 8 ───
        await _seed_subject(
            db, curricula["CBSE"],
            code="SCI", name="Science", class_grade=8,
            textbook_name="NCERT Science Class 8",
            total_marks=80,
            chapters=CBSE_SCIENCE_8_CHAPTERS,
        )

        # ─── ICSE English Class 10 ───
        await _seed_subject(
            db, curricula["ICSE"],
            code="ENG", name="English", class_grade=10,
            textbook_name="Treasure Trove / Total English",
            total_marks=100,
            chapters=ICSE_ENGLISH_10_CHAPTERS,
        )

        # ─── ICSE Math Class 10 extra chapters (Sets, Statistics, Mensuration) ───
        # These are added to the existing ICSE Math subject
        existing_icse_math = await db.execute(
            select(CurriculumSubject).where(
                CurriculumSubject.curriculum_id == curricula["ICSE"].id,
                CurriculumSubject.code == "MATH",
                CurriculumSubject.class_grade == 10,
            )
        )
        icse_math_subject = existing_icse_math.scalar_one_or_none()
        if icse_math_subject:
            for ch_data in ICSE_MATH_10_EXTRA_CHAPTERS:
                existing_ch = await db.execute(
                    select(CurriculumChapter).where(
                        CurriculumChapter.subject_id == icse_math_subject.id,
                        CurriculumChapter.name == ch_data["name"],
                    )
                )
                if not existing_ch.scalar_one_or_none():
                    chapter = CurriculumChapter(
                        subject_id=icse_math_subject.id,
                        number=ch_data["number"],
                        name=ch_data["name"],
                        textbook_reference=ch_data.get("textbook_reference"),
                        marks_weightage=ch_data.get("marks_weightage"),
                    )
                    db.add(chapter)
                    await db.flush()
                    for topic_data in ch_data.get("topics", []):
                        topic_name = topic_data[0] if isinstance(topic_data, tuple) else topic_data
                        topic_desc = topic_data[1] if isinstance(topic_data, tuple) and len(topic_data) > 1 else None
                        db.add(CurriculumTopic(
                            chapter_id=chapter.id,
                            name=topic_name,
                            description=topic_desc,
                        ))

        # ─── Skeleton subjects (no chapters yet) ───
        skeleton_subjects = [
            ("CBSE", "SCI", "Science", 9, "NCERT Science Class 9", 80),
            ("CBSE", "MATH", "Mathematics", 8, "NCERT Mathematics Class 8", 80),
            ("ICSE", "SCI", "Science", 10, "Selina Concise Science", 80),
        ]
        for board_code, subj_code, subj_name, grade, textbook, marks in skeleton_subjects:
            curriculum = curricula[board_code]
            existing = await db.execute(
                select(CurriculumSubject).where(
                    CurriculumSubject.curriculum_id == curriculum.id,
                    CurriculumSubject.code == subj_code,
                    CurriculumSubject.class_grade == grade,
                )
            )
            if not existing.scalar_one_or_none():
                db.add(CurriculumSubject(
                    curriculum_id=curriculum.id,
                    code=subj_code, name=subj_name,
                    class_grade=grade, textbook_name=textbook,
                    total_marks=marks,
                ))

        await db.commit()

        # ─── Summary ───
        chapter_count = (await db.execute(select(CurriculumChapter))).scalars().all()
        topic_count = (await db.execute(select(CurriculumTopic))).scalars().all()
        lo_count = (await db.execute(select(LearningOutcome))).scalars().all()
        qp_count = (await db.execute(select(QuestionPattern))).scalars().all()

        print("=" * 60)
        print("Curriculum data seeded successfully!")
        print("=" * 60)
        print(f"  Boards:             {len(board_records)}")
        print(f"  Curricula:          {len(curricula)}")
        print(f"  Chapters:           {len(chapter_count)}")
        print(f"  Topics:             {len(topic_count)}")
        print(f"  Learning Outcomes:  {len(lo_count)}")
        print(f"  Question Patterns:  {len(qp_count)}")


async def _seed_subject(
    db, curriculum, code, name, class_grade, textbook_name, total_marks, chapters
):
    """Seed a subject with chapters, topics, learning outcomes, and question patterns."""
    # Check if subject already exists
    existing = await db.execute(
        select(CurriculumSubject).where(
            CurriculumSubject.curriculum_id == curriculum.id,
            CurriculumSubject.code == code,
            CurriculumSubject.class_grade == class_grade,
        )
    )
    subject = existing.scalar_one_or_none()
    if subject:
        # Already seeded -- check if chapters exist
        existing_ch = await db.execute(
            select(CurriculumChapter).where(CurriculumChapter.subject_id == subject.id)
        )
        if existing_ch.scalars().first():
            return  # Already fully seeded
    else:
        subject = CurriculumSubject(
            curriculum_id=curriculum.id,
            code=code, name=name, class_grade=class_grade,
            textbook_name=textbook_name, total_marks=total_marks,
        )
        db.add(subject)
        await db.flush()

    for ch_data in chapters:
        chapter = CurriculumChapter(
            subject_id=subject.id,
            number=ch_data["number"],
            name=ch_data["name"],
            textbook_reference=ch_data.get("textbook_reference"),
            marks_weightage=ch_data.get("marks_weightage"),
            question_pattern_notes=ch_data.get("question_pattern_notes"),
        )
        db.add(chapter)
        await db.flush()

        # Topics and their learning outcomes
        for topic_data in ch_data.get("topics", []):
            topic_name = topic_data[0] if isinstance(topic_data, tuple) else topic_data
            topic_desc = topic_data[1] if isinstance(topic_data, tuple) and len(topic_data) > 1 else None
            topic = CurriculumTopic(
                chapter_id=chapter.id,
                name=topic_name,
                description=topic_desc,
            )
            db.add(topic)
            await db.flush()

        # Learning outcomes (linked to first topic if no specific mapping)
        topics_result = await db.execute(
            select(CurriculumTopic).where(CurriculumTopic.chapter_id == chapter.id)
        )
        chapter_topics = topics_result.scalars().all()

        for i, lo_data in enumerate(ch_data.get("learning_outcomes", [])):
            lo_code = lo_data[0] if isinstance(lo_data, tuple) else None
            lo_desc = lo_data[1] if isinstance(lo_data, tuple) else lo_data
            lo_bloom = lo_data[2] if isinstance(lo_data, tuple) and len(lo_data) > 2 else None
            lo_comp = lo_data[3] if isinstance(lo_data, tuple) and len(lo_data) > 3 else None
            # Assign to topic by index (distribute evenly)
            topic_idx = min(i, len(chapter_topics) - 1) if chapter_topics else 0
            target_topic = chapter_topics[topic_idx] if chapter_topics else None
            if target_topic:
                db.add(LearningOutcome(
                    topic_id=target_topic.id,
                    code=lo_code,
                    description=lo_desc,
                    bloom_level=lo_bloom,
                    competency_type=lo_comp,
                ))

        # Question patterns
        for qp_data in ch_data.get("question_patterns", []):
            q_type = qp_data[0]
            q_marks = qp_data[1]
            q_freq = qp_data[2] if len(qp_data) > 2 else None
            q_notes = qp_data[3] if len(qp_data) > 3 else None
            q_example = qp_data[4] if len(qp_data) > 4 else None
            q_year = qp_data[5] if len(qp_data) > 5 else None
            db.add(QuestionPattern(
                chapter_id=chapter.id,
                question_type=q_type,
                typical_marks=q_marks,
                frequency=q_freq,
                pattern_notes=q_notes,
                example_question=q_example,
                source_year=q_year,
            ))


if __name__ == "__main__":
    asyncio.run(seed_curriculum())
