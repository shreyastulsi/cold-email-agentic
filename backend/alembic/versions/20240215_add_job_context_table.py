"""add job_context table

Revision ID: add_job_context_table
Revises: 86e4fd825eef_add_outreach_history_table
Create Date: 2025-02-15 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "add_job_context_table"
down_revision: Union[str, None] = "86e4fd825eef"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "job_contexts" not in inspector.get_table_names():
        op.create_table(
            "job_contexts",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("job_url", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=True),
            sa.Column("company", sa.String(), nullable=True),
            sa.Column("employment_type", sa.String(), nullable=True),
            sa.Column("condensed_description", sa.Text(), nullable=True),
            sa.Column("requirements", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("technologies", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("responsibilities", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("raw_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
                onupdate=sa.func.now(),
            ),
            sa.UniqueConstraint("job_url", name="uq_job_contexts_job_url"),
        )


def downgrade() -> None:
    op.drop_table("job_contexts")

