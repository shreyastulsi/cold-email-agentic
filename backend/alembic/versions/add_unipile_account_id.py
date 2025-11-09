"""add unipile_account_id to linkedin_accounts

Revision ID: add_unipile_account_id
Revises: add_linkedin_accounts
Create Date: 2025-01-27 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_unipile_account_id'
down_revision: Union[str, None] = 'add_linkedin_accounts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add unipile_account_id column to linkedin_accounts table
    # Check if column already exists to avoid errors
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('linkedin_accounts')]
    
    if 'unipile_account_id' not in columns:
        op.add_column('linkedin_accounts', 
            sa.Column('unipile_account_id', sa.String(), nullable=True)
        )


def downgrade() -> None:
    # Remove unipile_account_id column
    op.drop_column('linkedin_accounts', 'unipile_account_id')

