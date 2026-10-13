"""Align remaining V1 fields and enforce unique generic links and custom types."""

import sqlalchemy as sa

from alembic import op

revision = "notebook_workspace"
down_revision = "m2_archive_deadlines"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("sticky_notes", "color_variant", new_column_name="color_token")
    op.alter_column("timeline_entries", "occurred_on", new_column_name="event_date")
    op.add_column("library_types", sa.Column("slug", sa.Text(), nullable=True))
    op.execute(
        "UPDATE library_types SET slug = trim(both '-' from "
        "regexp_replace(lower(name), '[^[:alnum:]]+', '-', 'g'))"
    )
    op.alter_column("library_types", "slug", nullable=False)
    op.create_index(
        "uq_library_type_slug", "library_types", ["user_id", "slug"], unique=True
    )
    # Existing links did not have an API; canonicalize orientation before indexing.
    op.execute("""UPDATE entity_links SET source_type=target_type, source_id=target_id,
                  target_type=source_type, target_id=source_id
                  WHERE (source_type, source_id) > (target_type, target_id)""")
    op.execute("""DELETE FROM entity_links a USING entity_links b WHERE a.id > b.id
                  AND (a.user_id,a.source_type,a.source_id,a.target_type,a.target_id)
                    = (b.user_id,b.source_type,b.source_id,b.target_type,b.target_id)
                  """)
    op.create_index(
        "uq_entity_link",
        "entity_links",
        ["user_id", "source_type", "source_id", "target_type", "target_id"],
        unique=True,
    )


def downgrade():
    op.drop_index("uq_entity_link", table_name="entity_links")
    op.drop_index("uq_library_type_slug", table_name="library_types")
    op.drop_column("library_types", "slug")
    op.alter_column("timeline_entries", "event_date", new_column_name="occurred_on")
    op.alter_column("sticky_notes", "color_token", new_column_name="color_variant")
