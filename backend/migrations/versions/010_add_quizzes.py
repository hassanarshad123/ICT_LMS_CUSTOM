"""Add quizzes, questions, attempts, and answers tables

Revision ID: 010
Revises: 009
Create Date: 2026-03-11
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    # ── Enums (use DO block to handle already-exists in async drivers) ──
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE question_type AS ENUM ('mcq', 'true_false', 'short_answer');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE quiz_attempt_status AS ENUM ('in_progress', 'submitted', 'graded');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # Reference the enums for column definitions (create_type=False since we created them above)
    question_type = postgresql.ENUM(
        'mcq', 'true_false', 'short_answer',
        name='question_type', create_type=False,
    )
    quiz_attempt_status = postgresql.ENUM(
        'in_progress', 'submitted', 'graded',
        name='quiz_attempt_status', create_type=False,
    )

    # ── quizzes ────────────────────────────────────────────────
    op.create_table(
        'quizzes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('module_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('time_limit_minutes', sa.Integer(), nullable=True),
        sa.Column('pass_percentage', sa.Integer(), nullable=False, server_default='50'),
        sa.Column('max_attempts', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('sequence_order', sa.Integer(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('institute_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id']),
        sa.ForeignKeyConstraint(['module_id'], ['curriculum_modules.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['institute_id'], ['institutes.id']),
    )
    op.create_index('ix_quizzes_course_id', 'quizzes', ['course_id'])
    op.create_index('ix_quizzes_module_id', 'quizzes', ['module_id'])

    # ── quiz_questions ─────────────────────────────────────────
    op.create_table(
        'quiz_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quiz_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('question_type', question_type, nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('options', postgresql.JSONB(), nullable=True),
        sa.Column('correct_answer', sa.String(), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('sequence_order', sa.Integer(), nullable=False),
        sa.Column('explanation', sa.String(), nullable=True),
        sa.Column('institute_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id']),
        sa.ForeignKeyConstraint(['institute_id'], ['institutes.id']),
    )
    op.create_index('ix_quiz_questions_quiz_id', 'quiz_questions', ['quiz_id'])

    # ── quiz_attempts ──────────────────────────────────────────
    op.create_table(
        'quiz_attempts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quiz_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', quiz_attempt_status, nullable=False, server_default='in_progress'),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('max_score', sa.Integer(), nullable=True),
        sa.Column('percentage', sa.Integer(), nullable=True),
        sa.Column('passed', sa.Boolean(), nullable=True),
        sa.Column('started_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('submitted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('graded_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('graded_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('institute_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['quiz_id'], ['quizzes.id']),
        sa.ForeignKeyConstraint(['student_id'], ['users.id']),
        sa.ForeignKeyConstraint(['graded_by'], ['users.id']),
        sa.ForeignKeyConstraint(['institute_id'], ['institutes.id']),
    )
    op.create_index('ix_quiz_attempts_quiz_student', 'quiz_attempts', ['quiz_id', 'student_id'])
    op.create_index('ix_quiz_attempts_student_id', 'quiz_attempts', ['student_id'])

    # ── quiz_answers ───────────────────────────────────────────
    op.create_table(
        'quiz_answers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('attempt_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('question_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('answer_text', sa.String(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('points_awarded', sa.Integer(), nullable=True),
        sa.Column('feedback', sa.String(), nullable=True),
        sa.Column('institute_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('attempt_id', 'question_id', name='uq_quiz_answer_attempt_question'),
        sa.ForeignKeyConstraint(['attempt_id'], ['quiz_attempts.id']),
        sa.ForeignKeyConstraint(['question_id'], ['quiz_questions.id']),
        sa.ForeignKeyConstraint(['institute_id'], ['institutes.id']),
    )
    op.create_index('ix_quiz_answers_attempt_id', 'quiz_answers', ['attempt_id'])


def downgrade():
    op.drop_table('quiz_answers')
    op.drop_table('quiz_attempts')
    op.drop_table('quiz_questions')
    op.drop_table('quizzes')

    # Drop enums
    quiz_attempt_status = postgresql.ENUM(name='quiz_attempt_status', create_type=False)
    quiz_attempt_status.drop(op.get_bind(), checkfirst=True)

    question_type = postgresql.ENUM(name='question_type', create_type=False)
    question_type.drop(op.get_bind(), checkfirst=True)
