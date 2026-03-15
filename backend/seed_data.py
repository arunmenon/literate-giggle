"""Seed script to populate database with comprehensive CBSE/ICSE question banks."""

import asyncio
import json
from datetime import datetime, timezone
from app.core.database import init_db, async_session
from app.core.security import get_password_hash
from app.models.user import User, StudentProfile, TeacherProfile, UserRole
from app.models.exam import (
    QuestionBank, Question, QuestionPaper, PaperQuestion,
    QuestionType, DifficultyLevel, BloomsTaxonomy, PaperStatus,
)

QT = QuestionType
DL = DifficultyLevel
BT = BloomsTaxonomy


def q(bank_id, qtype, text, marks, diff, blooms, topic, **kw):
    """Shorthand question builder."""
    return Question(
        bank_id=bank_id,
        question_type=qtype,
        question_text=text,
        marks=marks,
        difficulty=diff,
        blooms_level=blooms,
        topic=topic,
        subtopic=kw.get("subtopic"),
        model_answer=kw.get("model_answer"),
        answer_keywords=kw.get("answer_keywords"),
        mcq_options=kw.get("mcq_options"),
        correct_option=kw.get("correct_option"),
        marking_scheme=kw.get("marking_scheme"),
        source=kw.get("source"),
    )


async def seed():
    await init_db()

    async with async_session() as db:
        # ══════════════════════════════════════════
        # USERS
        # ══════════════════════════════════════════
        teacher = User(
            email="teacher@examiq.com",
            hashed_password=get_password_hash("teacher123"),
            full_name="Dr. Sharma",
            role=UserRole.TEACHER,
        )
        teacher2 = User(
            email="science.teacher@examiq.com",
            hashed_password=get_password_hash("teacher123"),
            full_name="Ms. Priya Menon",
            role=UserRole.TEACHER,
        )
        teacher3 = User(
            email="english.teacher@examiq.com",
            hashed_password=get_password_hash("teacher123"),
            full_name="Mr. Rajesh Iyer",
            role=UserRole.TEACHER,
        )
        student = User(
            email="student@examiq.com",
            hashed_password=get_password_hash("student123"),
            full_name="Arjun Kumar",
            role=UserRole.STUDENT,
        )
        student2 = User(
            email="student2@examiq.com",
            hashed_password=get_password_hash("student123"),
            full_name="Priya Patel",
            role=UserRole.STUDENT,
        )
        db.add_all([teacher, teacher2, teacher3, student, student2])
        await db.flush()

        # Profiles
        db.add(TeacherProfile(user_id=teacher.id, board="CBSE",
            subjects=json.dumps(["Mathematics"]), classes=json.dumps([9, 10]),
            institution="Delhi Public School"))
        db.add(TeacherProfile(user_id=teacher2.id, board="CBSE",
            subjects=json.dumps(["Science", "Physics", "Chemistry", "Biology"]),
            classes=json.dumps([9, 10]), institution="Delhi Public School"))
        db.add(TeacherProfile(user_id=teacher3.id, board="ICSE",
            subjects=json.dumps(["English", "Social Studies"]),
            classes=json.dumps([8, 9, 10]), institution="St. Xavier's School"))

        sp1 = StudentProfile(user_id=student.id, board="CBSE", class_grade=10,
            school_name="Delhi Public School", section="A", roll_number="1024")
        sp2 = StudentProfile(user_id=student2.id, board="ICSE", class_grade=10,
            school_name="St. Xavier's School", section="B", roll_number="2048")
        db.add_all([sp1, sp2])
        await db.flush()

        # ══════════════════════════════════════════
        # CBSE CLASS 10 MATHEMATICS
        # ══════════════════════════════════════════
        math_bank = QuestionBank(name="CBSE Class 10 Mathematics", board="CBSE",
            class_grade=10, subject="Mathematics", chapter="All Chapters",
            created_by=teacher.id)
        db.add(math_bank)
        await db.flush()

        math_qs = [
            q(math_bank.id, QT.MCQ, "If the sum of zeroes of the polynomial p(x) = 2x² - 5x + k is 5/2, then the value of k is:", 1, DL.EASY, BT.REMEMBER, "Polynomials",
              mcq_options={"a": "2", "b": "5", "c": "3", "d": "0"}, correct_option="d", source="CBSE 2023"),
            q(math_bank.id, QT.MCQ, "The distance between the points (3, 4) and (8, -3) is:", 1, DL.EASY, BT.APPLY, "Coordinate Geometry",
              mcq_options={"a": "√74", "b": "√24", "c": "√58", "d": "√34"}, correct_option="a", source="CBSE 2023"),
            q(math_bank.id, QT.MCQ, "The probability of getting a bad egg in a lot of 400 eggs is 0.035. The number of bad eggs is:", 1, DL.EASY, BT.APPLY, "Statistics",
              mcq_options={"a": "7", "b": "14", "c": "21", "d": "28"}, correct_option="b"),
            q(math_bank.id, QT.MCQ, "If tan θ = 12/5, then the value of (sin θ + cos θ) × sec θ is:", 1, DL.MEDIUM, BT.APPLY, "Trigonometry",
              mcq_options={"a": "17/5", "b": "12/5", "c": "17/12", "d": "5/12"}, correct_option="c"),
            q(math_bank.id, QT.MCQ, "The nth term of an AP is given by aₙ = 3n + 5. The common difference is:", 1, DL.EASY, BT.UNDERSTAND, "Arithmetic Progressions",
              mcq_options={"a": "3", "b": "5", "c": "8", "d": "2"}, correct_option="a"),
            q(math_bank.id, QT.TRUE_FALSE, "Every natural number is a whole number.", 1, DL.EASY, BT.REMEMBER, "Real Numbers",
              correct_option="true"),
            q(math_bank.id, QT.FILL_IN_BLANK, "The HCF of 26 and 91 is ____.", 1, DL.EASY, BT.REMEMBER, "Real Numbers",
              model_answer="13"),
            q(math_bank.id, QT.FILL_IN_BLANK, "If the discriminant of a quadratic equation is zero, the roots are ____ and ____.", 1, DL.EASY, BT.REMEMBER, "Quadratic Equations",
              model_answer="real|equal"),
            q(math_bank.id, QT.SHORT_ANSWER, "Find the value of k for which the system of equations 3x + y = 1 and (2k-1)x + (k-1)y = 2k+1 has no solution.", 3, DL.MEDIUM, BT.APPLY, "Linear Equations",
              model_answer="For no solution: a1/a2 = b1/b2 ≠ c1/c2. So 3/(2k-1) = 1/(k-1). Solving: 3(k-1) = 2k-1, 3k-3 = 2k-1, k = 2.",
              answer_keywords=["no solution", "a1/a2 = b1/b2", "k = 2", "parallel lines"]),
            q(math_bank.id, QT.SHORT_ANSWER, "Prove that √3 is an irrational number.", 3, DL.MEDIUM, BT.UNDERSTAND, "Real Numbers",
              model_answer="Assume √3 is rational, so √3 = p/q where p,q are coprime. Then p² = 3q². So p is divisible by 3. Let p = 3m, then q² = 3m². So q is also divisible by 3. Contradiction. Hence √3 is irrational.",
              answer_keywords=["assume rational", "p/q", "coprime", "contradiction", "divisible by 3", "irrational"]),
            q(math_bank.id, QT.SHORT_ANSWER, "Find the mean of: 4, 6, 7, 8, 9, 11, 13, 15.", 2, DL.EASY, BT.APPLY, "Statistics",
              model_answer="Mean = (4+6+7+8+9+11+13+15)/8 = 73/8 = 9.125",
              answer_keywords=["73", "8", "9.125", "mean"]),
            q(math_bank.id, QT.SHORT_ANSWER, "Find the roots of the quadratic equation x² - 7x + 12 = 0 by factorization.", 2, DL.EASY, BT.APPLY, "Quadratic Equations",
              model_answer="x² - 7x + 12 = 0 → x² - 3x - 4x + 12 = 0 → x(x-3) - 4(x-3) = 0 → (x-3)(x-4) = 0 → x = 3 or x = 4",
              answer_keywords=["factorization", "x-3", "x-4", "x = 3", "x = 4"]),
            q(math_bank.id, QT.SHORT_ANSWER, "Find the sum of first 20 terms of the AP: 2, 7, 12, 17, ...", 3, DL.MEDIUM, BT.APPLY, "Arithmetic Progressions",
              model_answer="a = 2, d = 5, n = 20. S₂₀ = 20/2 [2(2) + 19(5)] = 10[4 + 95] = 10 × 99 = 990",
              answer_keywords=["a = 2", "d = 5", "S₂₀", "990"]),
            q(math_bank.id, QT.LONG_ANSWER, "From the top of a 7m high building, the angle of elevation of the top of a cable tower is 60° and the angle of depression of its foot is 45°. Find the height of the cable tower.", 5, DL.HARD, BT.APPLY, "Trigonometry",
              model_answer="Let AB = 7m (building). From B, angle of elevation to D = 60°, depression to C = 45°. BC = 7m (tan 45°=1). BD = 7√3 (tan 60°=√3). Height = 7√3 + 7 = 7(√3+1) ≈ 19.12m.",
              answer_keywords=["tan 45°", "tan 60°", "√3", "7(√3 + 1)", "19.12"],
              marking_scheme=[
                  {"step": "Drawing figure", "marks": 1, "keywords": ["figure", "60°", "45°"]},
                  {"step": "Finding BC using tan 45°", "marks": 1, "keywords": ["tan 45°", "BC = 7"]},
                  {"step": "Finding BD using tan 60°", "marks": 1, "keywords": ["tan 60°", "√3", "7√3"]},
                  {"step": "Total height calculation", "marks": 1, "keywords": ["7√3 + 7", "7(√3 + 1)"]},
                  {"step": "Final answer", "marks": 1, "keywords": ["19.12"]},
              ]),
            q(math_bank.id, QT.NUMERICAL, "Find the area of a triangle with vertices (1, -1), (-4, 6) and (-3, -5).", 3, DL.MEDIUM, BT.APPLY, "Coordinate Geometry",
              model_answer="Area = ½|1(6+5) + (-4)(-5+1) + (-3)(-1-6)| = ½|11 + 16 + 21| = 24 sq units",
              answer_keywords=["24", "sq units"],
              marking_scheme=[
                  {"step": "Area formula", "marks": 1, "keywords": ["½", "x1", "y2-y3"]},
                  {"step": "Substitution", "marks": 1, "keywords": ["11", "16", "21"]},
                  {"step": "Final answer", "marks": 1, "keywords": ["24"]},
              ]),
            q(math_bank.id, QT.LONG_ANSWER, "A cone of height 24 cm and radius of base 6 cm is made up of modelling clay. A child reshapes it in the form of a sphere. Find the radius of the sphere.", 4, DL.MEDIUM, BT.APPLY, "Surface Areas and Volumes",
              model_answer="Volume of cone = ⅓πr²h = ⅓π(6)²(24) = 288π cm³. Volume of sphere = 4/3πR³. Setting equal: 4/3πR³ = 288π → R³ = 216 → R = 6 cm",
              answer_keywords=["volume of cone", "⅓πr²h", "288π", "4/3πR³", "R = 6", "216"]),
        ]
        for mq in math_qs:
            db.add(mq)
        await db.flush()

        # ══════════════════════════════════════════
        # CBSE CLASS 10 SCIENCE
        # ══════════════════════════════════════════
        sci_bank = QuestionBank(name="CBSE Class 10 Science", board="CBSE",
            class_grade=10, subject="Science", chapter="All Chapters",
            created_by=teacher2.id)
        db.add(sci_bank)
        await db.flush()

        sci_qs = [
            # Physics
            q(sci_bank.id, QT.MCQ, "The SI unit of electric current is:", 1, DL.EASY, BT.REMEMBER, "Electricity", subtopic="Current",
              mcq_options={"a": "Volt", "b": "Ampere", "c": "Ohm", "d": "Watt"}, correct_option="b"),
            q(sci_bank.id, QT.MCQ, "A concave mirror produces a real and inverted image of the same size as the object. The object is placed at:", 1, DL.MEDIUM, BT.UNDERSTAND, "Light - Reflection and Refraction", subtopic="Concave Mirror",
              mcq_options={"a": "Focus", "b": "Centre of curvature", "c": "Between F and C", "d": "Beyond C"}, correct_option="b"),
            q(sci_bank.id, QT.MCQ, "The resistance of a conductor is doubled when its length is doubled and area of cross-section remains same. This is because resistance is:", 1, DL.MEDIUM, BT.UNDERSTAND, "Electricity", subtopic="Resistance",
              mcq_options={"a": "Inversely proportional to length", "b": "Directly proportional to area", "c": "Directly proportional to length", "d": "Independent of length"}, correct_option="c"),
            q(sci_bank.id, QT.SHORT_ANSWER, "State Ohm's law. Draw V-I graph for an ohmic conductor.", 3, DL.MEDIUM, BT.UNDERSTAND, "Electricity", subtopic="Ohm's Law",
              model_answer="Ohm's Law: At constant temperature, the current flowing through a conductor is directly proportional to the potential difference across its ends. V = IR. The V-I graph is a straight line passing through the origin.",
              answer_keywords=["constant temperature", "directly proportional", "V = IR", "straight line", "origin", "potential difference", "current"]),
            q(sci_bank.id, QT.SHORT_ANSWER, "What is the difference between a real image and a virtual image? Give one example of each.", 3, DL.EASY, BT.UNDERSTAND, "Light - Reflection and Refraction",
              model_answer="Real image: formed when light rays actually converge; can be obtained on a screen; always inverted. Example: image formed by concave mirror when object is beyond F. Virtual image: formed when light rays appear to diverge from a point; cannot be obtained on a screen; always erect. Example: image in a plane mirror.",
              answer_keywords=["converge", "screen", "inverted", "diverge", "erect", "plane mirror", "concave mirror"]),
            q(sci_bank.id, QT.NUMERICAL, "An electric heater of resistance 20Ω is connected to a 220V supply. Calculate: (a) the current drawn, (b) the power consumed.", 3, DL.MEDIUM, BT.APPLY, "Electricity", subtopic="Power",
              model_answer="(a) I = V/R = 220/20 = 11A. (b) P = V × I = 220 × 11 = 2420W = 2.42kW",
              answer_keywords=["11", "2420", "V/R", "P = VI"],
              marking_scheme=[
                  {"step": "Current formula and calculation", "marks": 1.5, "keywords": ["V/R", "220/20", "11"]},
                  {"step": "Power formula and calculation", "marks": 1.5, "keywords": ["P = VI", "2420", "kW"]},
              ]),
            # Chemistry
            q(sci_bank.id, QT.MCQ, "The chemical formula of baking soda is:", 1, DL.EASY, BT.REMEMBER, "Acids, Bases and Salts", subtopic="Salts",
              mcq_options={"a": "NaCl", "b": "Na₂CO₃", "c": "NaHCO₃", "d": "NaOH"}, correct_option="c"),
            q(sci_bank.id, QT.MCQ, "Which gas is evolved when dilute HCl reacts with zinc?", 1, DL.EASY, BT.REMEMBER, "Chemical Reactions and Equations",
              mcq_options={"a": "Oxygen", "b": "Hydrogen", "c": "Chlorine", "d": "Nitrogen"}, correct_option="b"),
            q(sci_bank.id, QT.SHORT_ANSWER, "What happens when a solution of an acid is mixed with a solution of a base in a test tube? Write the reaction with an example.", 3, DL.MEDIUM, BT.UNDERSTAND, "Acids, Bases and Salts", subtopic="Neutralization",
              model_answer="When acid reacts with base, salt and water are formed. This is called neutralization reaction. Example: HCl + NaOH → NaCl + H₂O. The reaction is exothermic.",
              answer_keywords=["salt", "water", "neutralization", "NaCl", "HCl", "NaOH", "exothermic"]),
            q(sci_bank.id, QT.SHORT_ANSWER, "Balance the following chemical equation: Fe + H₂O → Fe₃O₄ + H₂", 2, DL.MEDIUM, BT.APPLY, "Chemical Reactions and Equations",
              model_answer="3Fe + 4H₂O → Fe₃O₄ + 4H₂",
              answer_keywords=["3Fe", "4H₂O", "Fe₃O₄", "4H₂"]),
            q(sci_bank.id, QT.LONG_ANSWER, "What is a chemical equation? Why should it be balanced? Explain with an example. Describe the different types of chemical reactions with one example each.", 5, DL.HARD, BT.ANALYZE, "Chemical Reactions and Equations",
              model_answer="A chemical equation is a symbolic representation of a chemical reaction using formulae of reactants and products. It must be balanced to satisfy the law of conservation of mass. Types: 1) Combination: 2Mg + O₂ → 2MgO. 2) Decomposition: 2FeSO₄ → Fe₂O₃ + SO₂ + SO₃. 3) Displacement: Zn + CuSO₄ → ZnSO₄ + Cu. 4) Double displacement: NaCl + AgNO₃ → AgCl + NaNO₃.",
              answer_keywords=["symbolic representation", "conservation of mass", "balanced", "combination", "decomposition", "displacement", "double displacement"]),
            # Biology
            q(sci_bank.id, QT.MCQ, "Which of the following is the correct sequence of organs in the human alimentary canal?", 1, DL.EASY, BT.REMEMBER, "Life Processes", subtopic="Nutrition",
              mcq_options={"a": "Mouth → Stomach → Small intestine → Large intestine → Oesophagus", "b": "Mouth → Oesophagus → Stomach → Large intestine → Small intestine", "c": "Mouth → Oesophagus → Stomach → Small intestine → Large intestine", "d": "Mouth → Stomach → Oesophagus → Small intestine → Large intestine"}, correct_option="c"),
            q(sci_bank.id, QT.SHORT_ANSWER, "Draw a diagram of the human heart and label the four chambers. Explain the flow of blood through the heart.", 5, DL.HARD, BT.UNDERSTAND, "Life Processes", subtopic="Transportation",
              model_answer="The heart has four chambers: right atrium, right ventricle, left atrium, left ventricle. Deoxygenated blood enters right atrium via vena cava → right ventricle → pulmonary artery → lungs. Oxygenated blood from lungs via pulmonary vein → left atrium → left ventricle → aorta → body. Valves prevent backflow.",
              answer_keywords=["right atrium", "right ventricle", "left atrium", "left ventricle", "pulmonary artery", "pulmonary vein", "aorta", "vena cava", "valves", "deoxygenated", "oxygenated"]),
            q(sci_bank.id, QT.SHORT_ANSWER, "What is photosynthesis? Write the balanced chemical equation. List the conditions necessary.", 3, DL.MEDIUM, BT.UNDERSTAND, "Life Processes", subtopic="Nutrition",
              model_answer="Photosynthesis is the process by which green plants prepare food using carbon dioxide and water in the presence of sunlight and chlorophyll. 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂. Conditions: sunlight, chlorophyll, carbon dioxide, water.",
              answer_keywords=["green plants", "carbon dioxide", "water", "sunlight", "chlorophyll", "C₆H₁₂O₆", "6CO₂", "glucose", "oxygen"]),
            q(sci_bank.id, QT.MCQ, "The process of breakdown of glucose (6-carbon molecule) into pyruvate (3-carbon molecule) is called:", 1, DL.MEDIUM, BT.REMEMBER, "Life Processes", subtopic="Respiration",
              mcq_options={"a": "Fermentation", "b": "Glycolysis", "c": "Krebs cycle", "d": "Oxidative phosphorylation"}, correct_option="b"),
        ]
        for sq in sci_qs:
            db.add(sq)
        await db.flush()

        # ══════════════════════════════════════════
        # CBSE CLASS 10 ENGLISH
        # ══════════════════════════════════════════
        eng_bank = QuestionBank(name="CBSE Class 10 English", board="CBSE",
            class_grade=10, subject="English", chapter="Grammar & Writing",
            created_by=teacher3.id)
        db.add(eng_bank)
        await db.flush()

        eng_qs = [
            q(eng_bank.id, QT.MCQ, "Choose the correct passive voice: 'Someone has stolen my wallet.'", 1, DL.EASY, BT.APPLY, "Grammar", subtopic="Voice",
              mcq_options={"a": "My wallet has been stolen.", "b": "My wallet was stolen.", "c": "My wallet had been stolen.", "d": "My wallet is being stolen."}, correct_option="a"),
            q(eng_bank.id, QT.MCQ, "Identify the figure of speech in: 'The wind howled in the night.'", 1, DL.MEDIUM, BT.ANALYZE, "Literature", subtopic="Figures of Speech",
              mcq_options={"a": "Simile", "b": "Metaphor", "c": "Personification", "d": "Alliteration"}, correct_option="c"),
            q(eng_bank.id, QT.MCQ, "Choose the correct option to fill in the blank: 'If I ____ you, I would apologize.'", 1, DL.MEDIUM, BT.APPLY, "Grammar", subtopic="Conditionals",
              mcq_options={"a": "am", "b": "was", "c": "were", "d": "be"}, correct_option="c"),
            q(eng_bank.id, QT.FILL_IN_BLANK, "The plural of 'phenomenon' is ____.", 1, DL.EASY, BT.REMEMBER, "Grammar", subtopic="Nouns",
              model_answer="phenomena"),
            q(eng_bank.id, QT.SHORT_ANSWER, "Transform the following into indirect speech: 'The teacher said to the students, \"Submit your assignments by Friday.\"'", 2, DL.MEDIUM, BT.APPLY, "Grammar", subtopic="Reported Speech",
              model_answer="The teacher told the students to submit their assignments by Friday.",
              answer_keywords=["told", "to submit", "their", "by Friday"]),
            q(eng_bank.id, QT.SHORT_ANSWER, "Read the passage and answer: 'Education is the most powerful weapon which you can use to change the world.' - Nelson Mandela. What does Mandela mean by calling education a 'weapon'?", 3, DL.MEDIUM, BT.ANALYZE, "Reading Comprehension",
              model_answer="Mandela uses the metaphor of a 'weapon' to emphasize that education is a powerful tool for transformation. Unlike physical weapons that destroy, education empowers people with knowledge and critical thinking to fight ignorance, poverty, and inequality, thereby bringing positive change to society.",
              answer_keywords=["metaphor", "powerful tool", "transformation", "knowledge", "change", "empowers", "inequality"]),
            q(eng_bank.id, QT.LONG_ANSWER, "Write a letter to the editor of a national newspaper expressing your concern about the increasing air pollution in your city. Suggest measures to control it. (120-150 words)", 5, DL.MEDIUM, BT.CREATE, "Writing", subtopic="Letter Writing",
              model_answer="The letter should include: proper format (sender's address, date, subject), opening paragraph stating the concern, body paragraphs with specific problems (vehicular emissions, industrial pollution, construction dust) and suggested measures (public transport, green zones, strict regulations, awareness campaigns), and a conclusion urging action.",
              answer_keywords=["format", "sir/madam", "air pollution", "vehicular emissions", "public transport", "measures", "awareness", "regulations", "health", "concern"]),
            q(eng_bank.id, QT.LONG_ANSWER, "Write a story in about 150-200 words with the beginning: 'It was a dark and stormy night when...'", 5, DL.HARD, BT.CREATE, "Writing", subtopic="Story Writing",
              model_answer="A good story should have: an engaging opening building on the given prompt, well-developed characters, a clear plot with conflict and resolution, descriptive language, and a satisfying conclusion.",
              answer_keywords=["characters", "plot", "conflict", "resolution", "descriptive", "dialogue", "conclusion"]),
            q(eng_bank.id, QT.SHORT_ANSWER, "Explain the difference between a simile and a metaphor with examples.", 3, DL.EASY, BT.UNDERSTAND, "Literature", subtopic="Figures of Speech",
              model_answer="A simile compares two things using 'like' or 'as'. Example: 'Her eyes sparkled like diamonds.' A metaphor directly states one thing is another. Example: 'Time is money.' Both are figures of speech used for comparison, but simile uses comparison words while metaphor does not.",
              answer_keywords=["like", "as", "comparison", "directly states", "example"]),
        ]
        for eq in eng_qs:
            db.add(eq)
        await db.flush()

        # ══════════════════════════════════════════
        # CBSE CLASS 10 SOCIAL STUDIES
        # ══════════════════════════════════════════
        sst_bank = QuestionBank(name="CBSE Class 10 Social Studies", board="CBSE",
            class_grade=10, subject="Social Studies", chapter="All Chapters",
            created_by=teacher3.id)
        db.add(sst_bank)
        await db.flush()

        sst_qs = [
            # History
            q(sst_bank.id, QT.MCQ, "The Civil Disobedience Movement was launched by Mahatma Gandhi in:", 1, DL.EASY, BT.REMEMBER, "History", subtopic="Nationalism in India",
              mcq_options={"a": "1920", "b": "1930", "c": "1942", "d": "1919"}, correct_option="b"),
            q(sst_bank.id, QT.MCQ, "The French Revolution began in the year:", 1, DL.EASY, BT.REMEMBER, "History", subtopic="French Revolution",
              mcq_options={"a": "1776", "b": "1789", "c": "1799", "d": "1804"}, correct_option="b"),
            q(sst_bank.id, QT.SHORT_ANSWER, "Explain the significance of the Salt March (Dandi March) in India's freedom struggle.", 3, DL.MEDIUM, BT.UNDERSTAND, "History", subtopic="Nationalism in India",
              model_answer="The Salt March (March 12 - April 6, 1930) was significant because: 1) It challenged the British monopoly on salt production, 2) It mobilized millions of Indians across castes, 3) It gained international attention and sympathy, 4) It demonstrated the power of non-violent civil disobedience, 5) It united diverse sections of Indian society.",
              answer_keywords=["1930", "salt tax", "non-violent", "civil disobedience", "British monopoly", "international", "Gandhi", "Dandi"]),
            # Geography
            q(sst_bank.id, QT.MCQ, "Black soil is most suitable for growing:", 1, DL.EASY, BT.REMEMBER, "Geography", subtopic="Soil Types",
              mcq_options={"a": "Wheat", "b": "Cotton", "c": "Rice", "d": "Tea"}, correct_option="b"),
            q(sst_bank.id, QT.SHORT_ANSWER, "Distinguish between renewable and non-renewable resources with examples.", 3, DL.EASY, BT.UNDERSTAND, "Geography", subtopic="Resources and Development",
              model_answer="Renewable resources can be replenished naturally over time (solar energy, wind, forests, water). Non-renewable resources exist in fixed quantities and cannot be replenished once exhausted (coal, petroleum, natural gas, minerals). Conservation of non-renewable resources is crucial for sustainable development.",
              answer_keywords=["replenished", "solar", "wind", "coal", "petroleum", "exhausted", "sustainable", "conservation"]),
            q(sst_bank.id, QT.LONG_ANSWER, "Why is conservation of resources necessary? Explain different ways to conserve resources.", 5, DL.MEDIUM, BT.ANALYZE, "Geography", subtopic="Resources and Development",
              model_answer="Conservation is necessary because: 1) Resources are limited, 2) Over-exploitation leads to ecological imbalance, 3) Future generations need resources. Ways: reduce consumption, reuse products, recycle waste, use renewable energy, afforestation, rainwater harvesting, sustainable agriculture.",
              answer_keywords=["limited", "future generations", "ecological", "reduce", "reuse", "recycle", "renewable energy", "sustainable", "afforestation"]),
            # Civics
            q(sst_bank.id, QT.MCQ, "How many subjects are there in the Union List of the Indian Constitution?", 1, DL.MEDIUM, BT.REMEMBER, "Civics", subtopic="Federalism",
              mcq_options={"a": "52", "b": "66", "c": "97", "d": "47"}, correct_option="c"),
            q(sst_bank.id, QT.SHORT_ANSWER, "What is federalism? Explain the key features of the Indian federal system.", 3, DL.MEDIUM, BT.UNDERSTAND, "Civics", subtopic="Federalism",
              model_answer="Federalism is a system where power is divided between central and state governments. Key features of Indian federalism: 1) Written Constitution, 2) Division of powers (Union, State, Concurrent lists), 3) Independent judiciary, 4) Supremacy of Constitution, 5) Bicameral legislature at centre.",
              answer_keywords=["division of powers", "central", "state", "written constitution", "independent judiciary", "union list", "state list", "concurrent"]),
            # Economics
            q(sst_bank.id, QT.MCQ, "The primary sector is also called:", 1, DL.EASY, BT.REMEMBER, "Economics", subtopic="Sectors of Economy",
              mcq_options={"a": "Industrial sector", "b": "Service sector", "c": "Agricultural sector", "d": "Manufacturing sector"}, correct_option="c"),
            q(sst_bank.id, QT.SHORT_ANSWER, "What is GDP? How is it calculated? Why is it used as a measure of development?", 3, DL.MEDIUM, BT.UNDERSTAND, "Economics", subtopic="Development",
              model_answer="GDP (Gross Domestic Product) is the total value of all goods and services produced within a country during a specific period. It is calculated by summing consumption, investment, government spending, and net exports. GDP is used as a development indicator because it reflects the overall economic output, though it doesn't capture inequality or quality of life.",
              answer_keywords=["total value", "goods and services", "consumption", "investment", "economic output", "inequality"]),
        ]
        for sq in sst_qs:
            db.add(sq)
        await db.flush()

        # ══════════════════════════════════════════
        # ICSE CLASS 10 MATHEMATICS
        # ══════════════════════════════════════════
        icse_math_bank = QuestionBank(name="ICSE Class 10 Mathematics", board="ICSE",
            class_grade=10, subject="Mathematics", chapter="All Chapters",
            created_by=teacher.id)
        db.add(icse_math_bank)
        await db.flush()

        icse_math_qs = [
            q(icse_math_bank.id, QT.MCQ, "The equation of a line passing through (2, 3) with slope 4 is:", 1, DL.MEDIUM, BT.APPLY, "Coordinate Geometry",
              mcq_options={"a": "y = 4x - 5", "b": "y = 4x + 5", "c": "y = 4x - 3", "d": "y = 4x + 3"}, correct_option="a", source="ICSE 2023"),
            q(icse_math_bank.id, QT.MCQ, "If A = {1, 2, 3} and B = {2, 3, 4}, then A ∩ B is:", 1, DL.EASY, BT.REMEMBER, "Sets",
              mcq_options={"a": "{1, 2, 3, 4}", "b": "{2, 3}", "c": "{1, 4}", "d": "{1}"}, correct_option="b"),
            q(icse_math_bank.id, QT.SHORT_ANSWER, "Using the remainder theorem, find the remainder when 2x³ - 3x² + 4x - 1 is divided by (x - 2).", 3, DL.MEDIUM, BT.APPLY, "Polynomials",
              model_answer="By remainder theorem, remainder = f(2) = 2(8) - 3(4) + 4(2) - 1 = 16 - 12 + 8 - 1 = 11",
              answer_keywords=["remainder theorem", "f(2)", "16", "12", "8", "11"]),
            q(icse_math_bank.id, QT.SHORT_ANSWER, "Solve the following system using matrices: 2x + 3y = 7 and 3x + 5y = 11.", 4, DL.HARD, BT.APPLY, "Matrices",
              model_answer="Using Cramer's rule or inverse matrix method. det = 2(5) - 3(3) = 1. x = (7×5 - 3×11)/1 = (35-33)/1 = 2. y = (2×11 - 7×3)/1 = (22-21)/1 = 1. Solution: x = 2, y = 1.",
              answer_keywords=["determinant", "x = 2", "y = 1", "inverse", "Cramer"]),
            q(icse_math_bank.id, QT.LONG_ANSWER, "A solid is in the shape of a cone surmounted on a hemisphere. The radius of each of them being 3.5 cm and the total height of the solid is 9.5 cm. Find the volume of the solid.", 5, DL.HARD, BT.APPLY, "Mensuration",
              model_answer="Radius = 3.5cm. Height of cone = 9.5 - 3.5 = 6cm. Volume of hemisphere = 2/3πr³ = 2/3 × 22/7 × (3.5)³ = 89.83 cm³. Volume of cone = 1/3πr²h = 1/3 × 22/7 × (3.5)² × 6 = 77 cm³. Total volume = 89.83 + 77 = 166.83 cm³.",
              answer_keywords=["hemisphere", "cone", "2/3πr³", "1/3πr²h", "3.5", "6", "166.83"]),
            q(icse_math_bank.id, QT.NUMERICAL, "Find the mean of the following frequency distribution: Class: 0-10, 10-20, 20-30, 30-40, 40-50. Frequency: 5, 8, 15, 16, 6.", 4, DL.MEDIUM, BT.APPLY, "Statistics",
              model_answer="Mean = Σfx/Σf = (5×5 + 8×15 + 15×25 + 16×35 + 6×45)/(5+8+15+16+6) = (25+120+375+560+270)/50 = 1350/50 = 27",
              answer_keywords=["Σfx", "Σf", "1350", "50", "27"],
              marking_scheme=[
                  {"step": "Finding class marks", "marks": 1, "keywords": ["5", "15", "25", "35", "45"]},
                  {"step": "Calculating Σfx", "marks": 1.5, "keywords": ["1350"]},
                  {"step": "Calculating mean", "marks": 1.5, "keywords": ["27"]},
              ]),
        ]
        for iq in icse_math_qs:
            db.add(iq)
        await db.flush()

        # ══════════════════════════════════════════
        # ICSE CLASS 10 ENGLISH
        # ══════════════════════════════════════════
        icse_eng_bank = QuestionBank(name="ICSE Class 10 English", board="ICSE",
            class_grade=10, subject="English", chapter="Literature & Grammar",
            created_by=teacher3.id)
        db.add(icse_eng_bank)
        await db.flush()

        icse_eng_qs = [
            q(icse_eng_bank.id, QT.MCQ, "In the poem 'The Rime of the Ancient Mariner', the albatross symbolizes:", 1, DL.MEDIUM, BT.ANALYZE, "Literature", subtopic="Poetry",
              mcq_options={"a": "Evil", "b": "Good luck and innocence", "c": "Death", "d": "Freedom"}, correct_option="b"),
            q(icse_eng_bank.id, QT.SHORT_ANSWER, "Read the extract and answer: 'To be, or not to be, that is the question.' - Explain the dilemma Hamlet faces in this soliloquy.", 3, DL.HARD, BT.ANALYZE, "Literature", subtopic="Shakespeare",
              model_answer="Hamlet contemplates the fundamental question of existence - whether it is nobler to endure life's sufferings passively ('to be') or to take action against them, potentially through death ('not to be'). The soliloquy reveals his inner conflict between action and inaction, life and death, courage and fear.",
              answer_keywords=["existence", "suffering", "action", "inaction", "death", "inner conflict", "courage", "dilemma"]),
            q(icse_eng_bank.id, QT.LONG_ANSWER, "Write a composition of about 300 words on: 'The Role of Technology in Modern Education'", 10, DL.HARD, BT.CREATE, "Writing", subtopic="Composition",
              model_answer="A good composition should include: introduction defining technology in education, body paragraphs covering benefits (access to information, interactive learning, personalized education, global connectivity) and challenges (digital divide, screen addiction, reduced social interaction), and a balanced conclusion.",
              answer_keywords=["introduction", "technology", "education", "access", "interactive", "personalized", "digital divide", "conclusion", "benefits", "challenges"]),
            q(icse_eng_bank.id, QT.SHORT_ANSWER, "Rewrite as directed: 'He is too weak to walk.' (Use 'so...that')", 2, DL.EASY, BT.APPLY, "Grammar", subtopic="Transformation",
              model_answer="He is so weak that he cannot walk.",
              answer_keywords=["so weak", "that", "cannot walk"]),
        ]
        for ie in icse_eng_qs:
            db.add(ie)
        await db.flush()

        # ══════════════════════════════════════════
        # CBSE CLASS 9 MATHEMATICS (extensibility demo)
        # ══════════════════════════════════════════
        math9_bank = QuestionBank(name="CBSE Class 9 Mathematics", board="CBSE",
            class_grade=9, subject="Mathematics", chapter="All Chapters",
            created_by=teacher.id)
        db.add(math9_bank)
        await db.flush()

        math9_qs = [
            q(math9_bank.id, QT.MCQ, "The value of √(2+√(2+√2)) is approximately:", 1, DL.MEDIUM, BT.APPLY, "Number Systems",
              mcq_options={"a": "1.414", "b": "1.848", "c": "1.961", "d": "2.000"}, correct_option="c"),
            q(math9_bank.id, QT.MCQ, "In triangle ABC, if ∠A = 50° and ∠B = 60°, then ∠C is:", 1, DL.EASY, BT.APPLY, "Triangles",
              mcq_options={"a": "60°", "b": "70°", "c": "80°", "d": "90°"}, correct_option="b"),
            q(math9_bank.id, QT.SHORT_ANSWER, "Factorise: x³ - 23x² + 142x - 120", 3, DL.HARD, BT.APPLY, "Polynomials",
              model_answer="By trial, x=1 is a root. Divide to get (x-1)(x²-22x+120) = (x-1)(x-10)(x-12).",
              answer_keywords=["x-1", "x-10", "x-12", "factor theorem"]),
            q(math9_bank.id, QT.SHORT_ANSWER, "Prove that the angles opposite to equal sides of a triangle are equal.", 4, DL.MEDIUM, BT.UNDERSTAND, "Triangles",
              model_answer="Given: Triangle ABC with AB = AC. Draw AD ⊥ BC. In triangles ABD and ACD: AB = AC (given), AD = AD (common), ∠ADB = ∠ADC = 90°. By RHS congruence, △ABD ≅ △ACD. Therefore ∠B = ∠C (CPCT).",
              answer_keywords=["congruence", "RHS", "CPCT", "equal sides", "equal angles", "perpendicular"]),
            q(math9_bank.id, QT.LONG_ANSWER, "A park in the shape of a quadrilateral ABCD has ∠C = 90°, AB = 9m, BC = 12m, CD = 5m and AD = 8m. Find the area of the park.", 5, DL.HARD, BT.APPLY, "Heron's Formula",
              model_answer="Join BD. In right △BCD: BD = √(12²+5²) = √(144+25) = 13m. Area of △BCD = ½×12×5 = 30 m². For △ABD: s = (9+13+8)/2 = 15. Area = √(15×6×2×7) = √1260 = 35.5 m². Total area = 30 + 35.5 = 65.5 m².",
              answer_keywords=["BD = 13", "30", "Heron's formula", "35.5", "65.5"]),
        ]
        for m9 in math9_qs:
            db.add(m9)
        await db.flush()

        # ══════════════════════════════════════════
        # CBSE CLASS 8 SCIENCE (lower class demo)
        # ══════════════════════════════════════════
        sci8_bank = QuestionBank(name="CBSE Class 8 Science", board="CBSE",
            class_grade=8, subject="Science", chapter="All Chapters",
            created_by=teacher2.id)
        db.add(sci8_bank)
        await db.flush()

        sci8_qs = [
            q(sci8_bank.id, QT.MCQ, "The process of converting sugar into alcohol is called:", 1, DL.EASY, BT.REMEMBER, "Microorganisms",
              mcq_options={"a": "Fermentation", "b": "Pasteurization", "c": "Decomposition", "d": "Oxidation"}, correct_option="a"),
            q(sci8_bank.id, QT.MCQ, "Which force acts on a ball rolling on the ground and brings it to rest?", 1, DL.EASY, BT.UNDERSTAND, "Force and Pressure",
              mcq_options={"a": "Gravitational force", "b": "Frictional force", "c": "Magnetic force", "d": "Muscular force"}, correct_option="b"),
            q(sci8_bank.id, QT.SHORT_ANSWER, "What are synthetic fibres? Give two examples and their uses.", 3, DL.EASY, BT.UNDERSTAND, "Synthetic Fibres and Plastics",
              model_answer="Synthetic fibres are man-made fibres prepared by chemical processing of petrochemicals. Examples: 1) Nylon - used in making ropes, parachutes, stockings. 2) Polyester - used in making clothes, PET bottles, curtains.",
              answer_keywords=["man-made", "petrochemicals", "nylon", "polyester", "ropes", "clothes"]),
            q(sci8_bank.id, QT.SHORT_ANSWER, "Explain the difference between combustible and non-combustible substances with examples.", 2, DL.EASY, BT.UNDERSTAND, "Combustion and Flame",
              model_answer="Combustible substances catch fire easily and burn in air (wood, paper, kerosene). Non-combustible substances do not catch fire (glass, stone, iron).",
              answer_keywords=["catch fire", "burn", "wood", "paper", "glass", "stone"]),
        ]
        for s8 in sci8_qs:
            db.add(s8)
        await db.flush()

        # ══════════════════════════════════════════
        # QUESTION PAPERS
        # ══════════════════════════════════════════

        # Paper 1: CBSE Class 10 Math Unit Test
        paper1 = QuestionPaper(
            title="CBSE Class 10 Mathematics - Unit Test 1",
            board="CBSE", class_grade=10, subject="Mathematics",
            academic_year="2025-26", exam_type="Unit Test",
            total_marks=20, duration_minutes=45,
            instructions="1. All questions compulsory.\n2. Show all working.\n3. Draw neat diagrams.",
            sections=[
                {"name": "Section A", "instructions": "Objective (1 mark each)", "marks": 5},
                {"name": "Section B", "instructions": "Short answer (2-3 marks)", "marks": 10},
                {"name": "Section C", "instructions": "Long answer (5 marks)", "marks": 5},
            ],
            created_by=teacher.id, status=PaperStatus.PUBLISHED,
        )
        db.add(paper1)
        await db.flush()

        for i, mq in enumerate(math_qs[:10]):
            section = "Section A" if mq.marks <= 1 else ("Section B" if mq.marks <= 3 else "Section C")
            db.add(PaperQuestion(paper_id=paper1.id, question_id=mq.id, section=section, order=i+1))

        # Paper 2: CBSE Class 10 Science Mid-term
        paper2 = QuestionPaper(
            title="CBSE Class 10 Science - Mid-term Exam",
            board="CBSE", class_grade=10, subject="Science",
            academic_year="2025-26", exam_type="Mid-term",
            total_marks=80, duration_minutes=180,
            instructions="1. All questions compulsory.\n2. Internal choice in long answer questions.\n3. Draw labeled diagrams.",
            sections=[
                {"name": "Section A", "instructions": "MCQ (1 mark each)", "marks": 16},
                {"name": "Section B", "instructions": "Short answer (2-3 marks)", "marks": 30},
                {"name": "Section C", "instructions": "Long answer (5 marks)", "marks": 34},
            ],
            created_by=teacher2.id, status=PaperStatus.PUBLISHED,
        )
        db.add(paper2)
        await db.flush()

        for i, sq in enumerate(sci_qs):
            section = "Section A" if sq.marks <= 1 else ("Section B" if sq.marks <= 3 else "Section C")
            db.add(PaperQuestion(paper_id=paper2.id, question_id=sq.id, section=section, order=i+1))

        # Paper 3: CBSE Class 10 English Practice
        paper3 = QuestionPaper(
            title="CBSE Class 10 English - Practice Paper",
            board="CBSE", class_grade=10, subject="English",
            academic_year="2025-26", exam_type="Practice",
            total_marks=80, duration_minutes=180,
            instructions="1. Attempt all questions.\n2. Write neat and legible answers.",
            created_by=teacher3.id, status=PaperStatus.PUBLISHED,
        )
        db.add(paper3)
        await db.flush()

        for i, eq in enumerate(eng_qs):
            db.add(PaperQuestion(paper_id=paper3.id, question_id=eq.id, section="Section A", order=i+1))

        # Paper 4: CBSE Class 10 Social Studies
        paper4 = QuestionPaper(
            title="CBSE Class 10 Social Studies - Unit Test",
            board="CBSE", class_grade=10, subject="Social Studies",
            academic_year="2025-26", exam_type="Unit Test",
            total_marks=40, duration_minutes=90,
            instructions="1. All questions compulsory.\n2. Support answers with examples.",
            created_by=teacher3.id, status=PaperStatus.PUBLISHED,
        )
        db.add(paper4)
        await db.flush()

        for i, sq in enumerate(sst_qs):
            db.add(PaperQuestion(paper_id=paper4.id, question_id=sq.id, section="Section A", order=i+1))

        # Paper 5: ICSE Class 10 Math
        paper5 = QuestionPaper(
            title="ICSE Class 10 Mathematics - Board Pattern",
            board="ICSE", class_grade=10, subject="Mathematics",
            academic_year="2025-26", exam_type="Board Pattern",
            total_marks=80, duration_minutes=150,
            instructions="1. Answer all questions from Section A.\n2. Answer any four from Section B.",
            created_by=teacher.id, status=PaperStatus.PUBLISHED,
        )
        db.add(paper5)
        await db.flush()

        for i, iq in enumerate(icse_math_qs):
            db.add(PaperQuestion(paper_id=paper5.id, question_id=iq.id, section="Section A", order=i+1))

        await db.commit()

        print("=" * 60)
        print("Database seeded successfully!")
        print("=" * 60)
        print()
        print("Question Banks:")
        print(f"  1. CBSE Class 10 Mathematics   - {len(math_qs)} questions")
        print(f"  2. CBSE Class 10 Science        - {len(sci_qs)} questions")
        print(f"  3. CBSE Class 10 English        - {len(eng_qs)} questions")
        print(f"  4. CBSE Class 10 Social Studies  - {len(sst_qs)} questions")
        print(f"  5. ICSE Class 10 Mathematics    - {len(icse_math_qs)} questions")
        print(f"  6. ICSE Class 10 English        - {len(icse_eng_qs)} questions")
        print(f"  7. CBSE Class 9 Mathematics     - {len(math9_qs)} questions")
        print(f"  8. CBSE Class 8 Science         - {len(sci8_qs)} questions")
        print()
        print("Question Papers:")
        print("  1. CBSE Class 10 Math Unit Test (20 marks, 45 min)")
        print("  2. CBSE Class 10 Science Mid-term (80 marks, 180 min)")
        print("  3. CBSE Class 10 English Practice (80 marks, 180 min)")
        print("  4. CBSE Class 10 Social Studies Unit Test (40 marks, 90 min)")
        print("  5. ICSE Class 10 Mathematics Board Pattern (80 marks, 150 min)")
        print()
        print("Login Credentials:")
        print("  Teacher:  teacher@examiq.com / teacher123")
        print("  Teacher:  science.teacher@examiq.com / teacher123")
        print("  Teacher:  english.teacher@examiq.com / teacher123")
        print("  Student:  student@examiq.com / student123  (CBSE Class 10)")
        print("  Student:  student2@examiq.com / student123  (ICSE Class 10)")


if __name__ == "__main__":
    asyncio.run(seed())
