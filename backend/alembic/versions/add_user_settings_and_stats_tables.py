"""add user settings and stats tables

Revision ID: add_user_settings_stats
Revises: add_draft_sent_status_fields
Create Date: 2025-01-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_user_settings_stats'
down_revision: Union[str, None] = 'add_draft_sent_status_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create user_settings table
    op.create_table('user_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('active_email_account_id', sa.Integer(), nullable=True),
        sa.Column('active_linkedin_account_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['active_email_account_id'], ['email_accounts.id']),
        sa.ForeignKeyConstraint(['active_linkedin_account_id'], ['linkedin_accounts.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_user_settings_user_id'), 'user_settings', ['user_id'], unique=True)
    
    # Create user_stats table
    op.create_table('user_stats',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('linkedin_invites_sent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('emails_sent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('roles_reached', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_linkedin_invite_at', sa.DateTime(), nullable=True),
        sa.Column('last_email_sent_at', sa.DateTime(), nullable=True),
        sa.Column('last_application_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_user_stats_user_id'), 'user_stats', ['user_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_stats_user_id'), table_name='user_stats')
    op.drop_table('user_stats')
    op.drop_index(op.f('ix_user_settings_user_id'), table_name='user_settings')
    op.drop_table('user_settings')

