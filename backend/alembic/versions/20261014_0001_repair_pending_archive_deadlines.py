"""Repair pending archive deadlines on databases that already applied M2 renames."""

from alembic import op

revision: str = "m2_archive_deadlines"
down_revision: str | None = "12cf1a15969c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Some local databases applied the rename before its data correction existed.
    # Future timestamps are deadlines, not past archive events. completed_at keeps
    # their deadline derivable, so clearing these values does not lose the timing.
    for table in ("goals", "projects"):
        op.execute(
            f"UPDATE {table} SET archived_at = NULL "
            "WHERE archived_at > CURRENT_TIMESTAMP"
        )


def downgrade() -> None:
    # Keep corrected events: the parent revision uses the same archive semantics.
    pass
