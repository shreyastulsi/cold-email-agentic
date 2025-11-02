"""add email accounts table

Revision ID: add_email_accounts
Revises: add_resume_content
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_email_accounts'
down_revision = 'add_resume_content'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'email_accounts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('owner_id', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=True),
        sa.Column('refresh_token', sa.Text(), nullable=True),
        sa.Column('access_token', sa.Text(), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('smtp_server', sa.String(), nullable=True),
        sa.Column('smtp_port', sa.String(), nullable=True),
        sa.Column('smtp_username', sa.String(), nullable=True),
        sa.Column('smtp_password', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_accounts_owner_id'), 'email_accounts', ['owner_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_email_accounts_owner_id'), table_name='email_accounts')
    op.drop_table('email_accounts')

