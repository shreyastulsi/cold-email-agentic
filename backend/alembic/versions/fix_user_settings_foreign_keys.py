"""fix user_settings foreign key constraints to allow deletion

Revision ID: fix_user_settings_fk
Revises: add_email_unique_constraint
Create Date: 2025-01-27 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fix_user_settings_fk'
down_revision: Union[str, None] = 'add_email_unique_constraint'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if table exists
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'user_settings' not in tables:
        return  # Table doesn't exist, skip this migration
    
    # Get existing foreign key constraints
    fk_constraints = inspector.get_foreign_keys('user_settings')
    constraint_names = {fk['name'] for fk in fk_constraints}
    
    # Drop existing foreign key constraints if they exist
    # Use raw SQL to properly set ON DELETE SET NULL
    if 'user_settings_active_email_account_id_fkey' in constraint_names:
        op.drop_constraint('user_settings_active_email_account_id_fkey', 'user_settings', type_='foreignkey')
    
    if 'user_settings_active_linkedin_account_id_fkey' in constraint_names:
        op.drop_constraint('user_settings_active_linkedin_account_id_fkey', 'user_settings', type_='foreignkey')
    
    # Recreate with ON DELETE SET NULL using raw SQL (Alembic's create_foreign_key doesn't support ondelete directly)
    op.execute("""
        ALTER TABLE user_settings
        ADD CONSTRAINT user_settings_active_email_account_id_fkey
        FOREIGN KEY (active_email_account_id)
        REFERENCES email_accounts(id)
        ON DELETE SET NULL;
    """)
    
    op.execute("""
        ALTER TABLE user_settings
        ADD CONSTRAINT user_settings_active_linkedin_account_id_fkey
        FOREIGN KEY (active_linkedin_account_id)
        REFERENCES linkedin_accounts(id)
        ON DELETE SET NULL;
    """)


def downgrade() -> None:
    # Revert to original constraints (without ondelete)
    op.drop_constraint('user_settings_active_email_account_id_fkey', 'user_settings', type_='foreignkey')
    op.drop_constraint('user_settings_active_linkedin_account_id_fkey', 'user_settings', type_='foreignkey')
    
    op.create_foreign_key(
        'user_settings_active_email_account_id_fkey',
        'user_settings',
        'email_accounts',
        ['active_email_account_id'],
        ['id']
    )
    op.create_foreign_key(
        'user_settings_active_linkedin_account_id_fkey',
        'user_settings',
        'linkedin_accounts',
        ['active_linkedin_account_id'],
        ['id']
    )

