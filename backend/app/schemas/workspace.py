import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.schemas.entities import Title

EntityType = Literal[
    "goal", "project", "note", "sticky_note", "library_item", "timeline_entry"
]
ColorToken = Literal["yellow", "sage", "blush", "blue", "lavender"]


class ReadModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


def validate_blocks(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    allowed = {
        "paragraph",
        "heading",
        "bulletListItem",
        "numberedListItem",
        "checkListItem",
    }

    def validate_inline(items):
        if isinstance(items, str):
            return
        if not isinstance(items, list):
            raise ValueError("Invalid text content")
        for item in items:
            if not isinstance(item, dict) or item.get("type") not in {"text", "link"}:
                raise ValueError("Only text and text links are supported")
            if item["type"] == "link":
                if not str(item.get("href", "")).startswith(
                    ("https://", "http://", "mailto:")
                ):
                    raise ValueError("Unsupported link URL")
                validate_inline(item.get("content", []))

    def walk(items, depth=0):
        if not isinstance(items, list):
            raise ValueError("Note children must be a list of blocks")
        if depth > 12:
            raise ValueError("Note nesting is too deep")
        for block in items:
            if not isinstance(block, dict) or block.get("type") not in allowed:
                raise ValueError(
                    "V1 notes support text, headings, lists and checklists only"
                )
            validate_inline(block.get("content", []))
            walk(block.get("children", []), depth + 1)

    walk(blocks)
    return blocks


class NoteWrite(BaseModel):
    title: Title
    content: list[dict[str, Any]] = Field(default_factory=list, max_length=2000)

    _validate_content = field_validator("content")(validate_blocks)


class NoteRead(ReadModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    content: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class StickyWrite(BaseModel):
    content: str = Field(min_length=1, max_length=10000)
    color_token: ColorToken = "yellow"

    @field_validator("content")
    @classmethod
    def trim_content(cls, value):
        if not value.strip():
            raise ValueError("Write something before saving")
        return value.strip()


class StickyRead(ReadModel):
    id: uuid.UUID
    user_id: uuid.UUID
    content: str
    color_token: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class TypeWrite(BaseModel):
    name: Title


class TypeRead(ReadModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    created_at: datetime
    name: str
    slug: str
    is_system: bool


class LibraryWrite(BaseModel):
    title: Title
    type_id: uuid.UUID
    url: HttpUrl | None = None
    description: str | None = Field(default=None, max_length=20000)


class LibraryRead(ReadModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    type_id: uuid.UUID
    url: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime


class TimelineWrite(BaseModel):
    title: Title
    description: str | None = Field(default=None, max_length=20000)
    event_date: date


class TimelineRead(ReadModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    event_date: date
    created_at: datetime
    updated_at: datetime


class LinkWrite(BaseModel):
    source_type: EntityType
    source_id: uuid.UUID
    target_type: EntityType
    target_id: uuid.UUID


class LinkRead(ReadModel):
    id: uuid.UUID
    user_id: uuid.UUID
    source_type: EntityType
    source_id: uuid.UUID
    target_type: EntityType
    target_id: uuid.UUID
    created_at: datetime
