"""add unique constraint to email_accounts

Revision ID: add_email_unique_constraint
Revises: add_user_settings_stats
Create Date: 2025-01-27 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_email_unique_constraint'
down_revision: Union[str, None] = 'add_user_settings_stats'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # First, remove duplicates by keeping the oldest account for each (owner_id, email) pair
    op.execute("""
        DELETE FROM email_accounts e1
        USING email_accounts e2
        WHERE e1.owner_id = e2.owner_id
        AND LOWER(e1.email) = LOWER(e2.email)
        AND e1.id > e2.id;
    """)
    
    # Add unique constraint on (owner_id, email) - case insensitive
    # Create a unique index instead of constraint for case-insensitive matching
    op.create_index(
        'ix_email_accounts_owner_email_unique',
        'email_accounts',
        ['owner_id', sa.text('LOWER(email)')],
        unique=True
    )


def downgrade() -> None:
    op.drop_index('ix_email_accounts_owner_email_unique', table_name='email_accounts')

