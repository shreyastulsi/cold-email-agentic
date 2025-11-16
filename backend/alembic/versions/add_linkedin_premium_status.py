"""add is_premium to linkedin_accounts

Revision ID: add_linkedin_premium_status
Revises: e96eb265e570
Create Date: 2025-11-13 20:36:18.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_linkedin_premium_status'
down_revision: Union[str, None] = 'e96eb265e570'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_premium column to linkedin_accounts table
    # Check if column already exists to avoid errors
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('linkedin_accounts')]
    
    if 'is_premium' not in columns:
        op.add_column('linkedin_accounts', 
            sa.Column('is_premium', sa.Boolean(), nullable=True)
        )


def downgrade() -> None:
    # Remove is_premium column
    op.drop_column('linkedin_accounts', 'is_premium')

