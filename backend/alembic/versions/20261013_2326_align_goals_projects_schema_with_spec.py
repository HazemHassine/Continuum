"""align_goals_projects_schema_with_spec

Revision ID: 12cf1a15969c
Revises: 20260928_0001
Create Date: 2026-10-13 23:26:18.575041

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "12cf1a15969c"
down_revision: str | None = "20260928_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # goals: rename progress -> progress_percent, archive_at -> archived_at
    op.alter_column("goals", "progress", new_column_name="progress_percent")
    op.alter_column("goals", "archive_at", new_column_name="archived_at")

    # projects: rename closed_at -> completed_at, archive_at -> archived_at
    op.alter_column("projects", "closed_at", new_column_name="completed_at")
    op.alter_column("projects", "archive_at", new_column_name="archived_at")

    # Old values were deadlines. Keep expired events, clear future deadlines.
    for table in ("goals", "projects"):
        op.execute(
            f"UPDATE {table} SET archived_at = NULL "
            "WHERE archived_at > CURRENT_TIMESTAMP"
        )


def downgrade() -> None:
    for table in ("goals", "projects"):
        op.execute(
            f"UPDATE {table} SET archived_at = completed_at + INTERVAL '2 days' "
            "WHERE archived_at IS NULL AND completed_at IS NOT NULL"
        )
    op.alter_column("projects", "archived_at", new_column_name="archive_at")
    op.alter_column("projects", "completed_at", new_column_name="closed_at")
    op.alter_column("goals", "archived_at", new_column_name="archive_at")
    op.alter_column("goals", "progress_percent", new_column_name="progress")
