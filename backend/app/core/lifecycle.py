from datetime import UTC, datetime, timedelta

GRACE_PERIOD_DAYS = 2


def archive_timestamp(
    completed_at: datetime | None, archived_at: datetime | None
) -> datetime | None:
    """Derive the archive event from the terminal timestamp, without a scheduler."""
    if archived_at is not None or completed_at is None:
        return archived_at
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=UTC)
    deadline = completed_at + timedelta(days=GRACE_PERIOD_DAYS)
    return deadline if datetime.now(UTC) >= deadline else None


def is_in_grace_period(
    completed_at: datetime | None,
    archived_at: datetime | None,
    now: datetime | None = None,
) -> bool:
    """Whether an item is still within its two-day grace window."""
    if archived_at is not None or completed_at is None:
        return False
    now = now or datetime.now(UTC)
    # Ensure completed_at is timezone-aware
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=UTC)
    return now < completed_at + timedelta(days=GRACE_PERIOD_DAYS)


def is_archived_item(
    completed_at: datetime | None,
    archived_at: datetime | None,
    now: datetime | None = None,
) -> bool:
    """Whether an item was archived or its two-day grace window expired."""
    if archived_at is not None:
        return True
    if completed_at is None:
        return False
    now = now or datetime.now(UTC)
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=UTC)
    return now >= completed_at + timedelta(days=GRACE_PERIOD_DAYS)
