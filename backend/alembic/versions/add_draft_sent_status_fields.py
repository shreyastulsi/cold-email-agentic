"""add draft sent status fields

Revision ID: add_draft_sent_status_fields
Revises: add_drafts_table
Create Date: 2025-11-05 20:45:38.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_draft_sent_status_fields'
down_revision = 'add_drafts_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add email_sent and linkedin_sent fields
    op.add_column('drafts', sa.Column('email_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('drafts', sa.Column('linkedin_sent', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('drafts', sa.Column('email_sent_at', sa.DateTime(), nullable=True))
    op.add_column('drafts', sa.Column('linkedin_sent_at', sa.DateTime(), nullable=True))
    
    # Migrate existing data: if is_sent is True, set both email_sent and linkedin_sent based on draft_type
    # This is a best-effort migration - we can't know which was actually sent
    op.execute("""
        UPDATE drafts 
        SET email_sent = CASE 
            WHEN draft_type = 'email' OR draft_type = 'both' THEN is_sent
            ELSE false
        END,
        linkedin_sent = CASE
            WHEN draft_type = 'linkedin' OR draft_type = 'both' THEN is_sent
            ELSE false
        END
        WHERE is_sent = true
    """)


def downgrade() -> None:
    op.drop_column('drafts', 'linkedin_sent_at')
    op.drop_column('drafts', 'email_sent_at')
    op.drop_column('drafts', 'linkedin_sent')
    op.drop_column('drafts', 'email_sent')

