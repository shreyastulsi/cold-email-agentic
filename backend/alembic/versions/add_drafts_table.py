"""add drafts table

Revision ID: add_drafts_table
Revises: add_linkedin_accounts
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_drafts_table'
down_revision = 'add_unipile_account_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if table already exists (in case migration was already run)
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    tables = inspector.get_table_names()
    
    if 'drafts' not in tables:
        op.create_table(
            'drafts',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('owner_id', sa.String(), nullable=False),
            sa.Column('draft_type', sa.String(), nullable=False),
            sa.Column('recipient_name', sa.String(), nullable=True),
            sa.Column('recipient_email', sa.String(), nullable=True),
            sa.Column('recipient_linkedin_url', sa.String(), nullable=True),
            sa.Column('email_subject', sa.String(), nullable=True),
            sa.Column('email_body', sa.Text(), nullable=True),
            sa.Column('linkedin_message', sa.Text(), nullable=True),
            sa.Column('job_title', sa.String(), nullable=True),
            sa.Column('company_name', sa.String(), nullable=True),
            sa.Column('recruiter_info', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('is_sent', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('sent_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
    
    # Check if index exists before creating
    indexes = [idx['name'] for idx in inspector.get_indexes('drafts')] if 'drafts' in tables else []
    if 'ix_drafts_owner_id' not in indexes:
        op.create_index(op.f('ix_drafts_owner_id'), 'drafts', ['owner_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_drafts_owner_id'), table_name='drafts')
    op.drop_table('drafts')

