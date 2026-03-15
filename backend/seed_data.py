"""Seed script to populate database with sample CBSE/ICSE questions."""

import asyncio
import json
from app.core.database import init_db, async_session
from app.core.security import get_password_hash
from app.models.user import User, StudentProfile, TeacherProfile, UserRole
from app.models.exam import (
    QuestionBank, Question, QuestionPaper, PaperQuestion,
    QuestionType, DifficultyLevel, BloomsTaxonomy, PaperStatus,
)


async def seed():
    await init_db()

    async with async_session() as db:
        # ── Create users ──
        teacher = User(
            email="teacher@examiq.com",
            hashed_password=get_password_hash("teacher123"),
            full_name="Dr. Sharma",
            role=UserRole.TEACHER,
        )
        db.add(teacher)
        await db.flush()

        teacher_profile = TeacherProfile(
            user_id=teacher.id,
            board="CBSE",
            subjects=json.dumps(["Mathematics", "Science"]),
            classes=json.dumps([9, 10]),
            institution="Delhi Public School",
        )
        db.add(teacher_profile)

        student = User(
            email="student@examiq.com",
            hashed_password=get_password_hash("student123"),
            full_name="Arjun Kumar",
            role=UserRole.STUDENT,
        )
        db.add(student)
        await db.flush()

        student_profile = StudentProfile(
            user_id=student.id,
            board="CBSE",
            class_grade=10,
            school_name="Delhi Public School",
            section="A",
            roll_number="1024",
        )
        db.add(student_profile)

        # ── Question Bank: CBSE Class 10 Mathematics ──
        math_bank = QuestionBank(
            name="CBSE Class 10 Mathematics - Full Syllabus",
            board="CBSE",
            class_grade=10,
            subject="Mathematics",
            chapter="All Chapters",
            created_by=teacher.id,
        )
        db.add(math_bank)
        await db.flush()

        math_questions = [
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.MCQ,
                question_text="If the sum of zeroes of the polynomial p(x) = 2x² - 5x + k is 5/2, then the value of k is:",
                marks=1,
                difficulty=DifficultyLevel.EASY,
                blooms_level=BloomsTaxonomy.REMEMBER,
                topic="Polynomials",
                mcq_options={"a": "2", "b": "5", "c": "3", "d": "0"},
                correct_option="d",
                source="CBSE 2023 Board",
            ),
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.MCQ,
                question_text="The distance between the points (3, 4) and (8, -3) is:",
                marks=1,
                difficulty=DifficultyLevel.EASY,
                blooms_level=BloomsTaxonomy.APPLY,
                topic="Coordinate Geometry",
                mcq_options={"a": "√74", "b": "√24", "c": "√58", "d": "√34"},
                correct_option="a",
                source="CBSE 2023 Board",
            ),
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.SHORT_ANSWER,
                question_text="Find the value of k for which the system of equations 3x + y = 1 and (2k-1)x + (k-1)y = 2k+1 has no solution.",
                marks=3,
                difficulty=DifficultyLevel.MEDIUM,
                blooms_level=BloomsTaxonomy.APPLY,
                topic="Linear Equations",
                model_answer="For no solution: a1/a2 = b1/b2 ≠ c1/c2. So 3/(2k-1) = 1/(k-1). Solving: 3(k-1) = 2k-1, 3k-3 = 2k-1, k = 2.",
                answer_keywords=["no solution", "a1/a2 = b1/b2", "k = 2", "parallel lines"],
            ),
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.SHORT_ANSWER,
                question_text="Prove that √3 is an irrational number.",
                marks=3,
                difficulty=DifficultyLevel.MEDIUM,
                blooms_level=BloomsTaxonomy.UNDERSTAND,
                topic="Real Numbers",
                model_answer="Assume √3 is rational, so √3 = p/q where p,q are coprime integers. Then 3 = p²/q², so p² = 3q². This means p is divisible by 3. Let p = 3m, then 9m² = 3q², so q² = 3m². This means q is also divisible by 3. But this contradicts that p,q are coprime. Hence √3 is irrational.",
                answer_keywords=["assume rational", "p/q", "coprime", "contradiction", "divisible by 3", "irrational"],
            ),
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.LONG_ANSWER,
                question_text="From the top of a 7m high building, the angle of elevation of the top of a cable tower is 60° and the angle of depression of its foot is 45°. Find the height of the cable tower.",
                marks=5,
                difficulty=DifficultyLevel.HARD,
                blooms_level=BloomsTaxonomy.APPLY,
                topic="Trigonometry",
                model_answer="Let AB = 7m (building), CD = h (tower). From B, angle of elevation to D = 60°, angle of depression to C = 45°. BC = AB = 7m (tan 45° = 1). BD/BC = tan 60° = √3. So BD = 7√3. Height of tower = BD + 7 = 7√3 + 7 = 7(√3 + 1) = 7(1.732 + 1) = 19.12m.",
                answer_keywords=["tan 45°", "tan 60°", "√3", "7(√3 + 1)", "19.12", "angle of elevation", "angle of depression"],
                marking_scheme=[
                    {"step": "Drawing figure and identifying angles", "marks": 1, "keywords": ["figure", "60°", "45°"]},
                    {"step": "Finding horizontal distance using tan 45°", "marks": 1, "keywords": ["tan 45°", "BC = 7"]},
                    {"step": "Finding BD using tan 60°", "marks": 1, "keywords": ["tan 60°", "√3", "7√3"]},
                    {"step": "Calculating total height", "marks": 1, "keywords": ["7√3 + 7", "7(√3 + 1)"]},
                    {"step": "Final answer", "marks": 1, "keywords": ["19.12"]},
                ],
            ),
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.NUMERICAL,
                question_text="Find the area of a triangle whose vertices are (1, -1), (-4, 6) and (-3, -5).",
                marks=3,
                difficulty=DifficultyLevel.MEDIUM,
                blooms_level=BloomsTaxonomy.APPLY,
                topic="Coordinate Geometry",
                model_answer="Area = ½|x1(y2-y3) + x2(y3-y1) + x3(y1-y2)| = ½|1(6+5) + (-4)(-5+1) + (-3)(-1-6)| = ½|11 + 16 + 21| = ½ × 48 = 24 sq units",
                answer_keywords=["24", "sq units", "area formula"],
                marking_scheme=[
                    {"step": "Using area formula", "marks": 1, "keywords": ["½", "x1", "y2-y3"]},
                    {"step": "Substituting values", "marks": 1, "keywords": ["11", "16", "21"]},
                    {"step": "Final answer", "marks": 1, "keywords": ["24"]},
                ],
            ),
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.MCQ,
                question_text="The probability of getting a bad egg in a lot of 400 eggs is 0.035. The number of bad eggs in the lot is:",
                marks=1,
                difficulty=DifficultyLevel.EASY,
                blooms_level=BloomsTaxonomy.APPLY,
                topic="Statistics",
                mcq_options={"a": "7", "b": "14", "c": "21", "d": "28"},
                correct_option="b",
            ),
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.TRUE_FALSE,
                question_text="Every natural number is a whole number.",
                marks=1,
                difficulty=DifficultyLevel.EASY,
                blooms_level=BloomsTaxonomy.REMEMBER,
                topic="Real Numbers",
                correct_option="true",
            ),
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.FILL_IN_BLANK,
                question_text="The HCF of 26 and 91 is ____.",
                marks=1,
                difficulty=DifficultyLevel.EASY,
                blooms_level=BloomsTaxonomy.REMEMBER,
                topic="Real Numbers",
                model_answer="13",
            ),
            Question(
                bank_id=math_bank.id,
                question_type=QuestionType.SHORT_ANSWER,
                question_text="Find the mean of the following data: 4, 6, 7, 8, 9, 11, 13, 15.",
                marks=2,
                difficulty=DifficultyLevel.EASY,
                blooms_level=BloomsTaxonomy.APPLY,
                topic="Statistics",
                model_answer="Mean = (4+6+7+8+9+11+13+15)/8 = 73/8 = 9.125",
                answer_keywords=["73", "8", "9.125", "mean"],
            ),
        ]

        for q in math_questions:
            db.add(q)
        await db.flush()

        # ── Create a sample question paper ──
        paper = QuestionPaper(
            title="CBSE Class 10 Mathematics - Unit Test 1",
            board="CBSE",
            class_grade=10,
            subject="Mathematics",
            academic_year="2025-26",
            exam_type="Unit Test",
            total_marks=20,
            duration_minutes=45,
            instructions="1. All questions are compulsory.\n2. Show all working.\n3. Draw neat diagrams where necessary.",
            sections=[
                {"name": "Section A", "instructions": "MCQ & objective (1 mark each)", "marks": 5},
                {"name": "Section B", "instructions": "Short answer (2-3 marks each)", "marks": 10},
                {"name": "Section C", "instructions": "Long answer (5 marks)", "marks": 5},
            ],
            created_by=teacher.id,
            status=PaperStatus.PUBLISHED,
        )
        db.add(paper)
        await db.flush()

        # Add all questions to paper
        for i, q in enumerate(math_questions):
            section = "Section A" if q.marks <= 1 else ("Section B" if q.marks <= 3 else "Section C")
            pq = PaperQuestion(
                paper_id=paper.id,
                question_id=q.id,
                section=section,
                order=i + 1,
                is_compulsory=True,
            )
            db.add(pq)

        await db.commit()
        print("Database seeded successfully!")
        print("Teacher login: teacher@examiq.com / teacher123")
        print("Student login: student@examiq.com / student123")


if __name__ == "__main__":
    asyncio.run(seed())
