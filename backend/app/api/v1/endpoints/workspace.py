import re
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import AuthenticatedUser, get_current_user
from app.db.session import get_db
from app.models.entities import (
    EntityLink,
    Goal,
    LibraryItem,
    LibraryType,
    Note,
    Project,
    StickyNote,
    TimelineEntry,
)
from app.schemas.workspace import (
    EntityType,
    LibraryRead,
    LibraryWrite,
    LinkRead,
    LinkWrite,
    NoteRead,
    NoteWrite,
    StickyRead,
    StickyWrite,
    TimelineRead,
    TimelineWrite,
    TypeRead,
    TypeWrite,
)

router = APIRouter()
DEFAULT_TYPES = ("book", "movie", "series", "article", "course", "video")
LINK_TABLES = {
    "goal": Goal,
    "project": Project,
    "note": Note,
    "sticky_note": StickyNote,
    "library_item": LibraryItem,
    "timeline_entry": TimelineEntry,
}


def owned(db, model, item_id, user_id):
    item = db.query(model).filter(model.id == item_id, model.user_id == user_id).first()
    if item is None:
        raise HTTPException(404, "Item not found")
    return item


def save(db, item):
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def editable(item):
    if item.archived_at is not None:
        raise HTTPException(400, "Archived items are read-only")


@router.get("/notes", response_model=list[NoteRead])
def list_notes(
    archived: bool = False,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Note).filter(Note.user_id == user.id)
    query = query.filter(
        Note.archived_at.is_not(None) if archived else Note.archived_at.is_(None)
    )
    return query.order_by(Note.updated_at.desc()).all()


@router.post("/notes", response_model=NoteRead, status_code=201)
def create_note(
    body: NoteWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return save(db, Note(user_id=user.id, **body.model_dump()))


@router.get("/notes/{item_id}", response_model=NoteRead)
def get_note(
    item_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return owned(db, Note, item_id, user.id)


@router.put("/notes/{item_id}", response_model=NoteRead)
def update_note(
    item_id: uuid.UUID,
    body: NoteWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = owned(db, Note, item_id, user.id)
    editable(note)
    note.title, note.content = body.title, body.content
    return save(db, note)


@router.post("/notes/{item_id}/archive", response_model=NoteRead)
def archive_note(
    item_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = owned(db, Note, item_id, user.id)
    note.archived_at = note.archived_at or datetime.now(UTC)
    return save(db, note)


@router.get("/sticky-notes", response_model=list[StickyRead])
def list_stickies(
    archived: bool = False,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(StickyNote).filter(StickyNote.user_id == user.id)
    query = query.filter(
        StickyNote.archived_at.is_not(None)
        if archived
        else StickyNote.archived_at.is_(None)
    )
    return query.order_by(StickyNote.created_at.desc()).all()


@router.post("/sticky-notes", response_model=StickyRead, status_code=201)
def create_sticky(
    body: StickyWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return save(db, StickyNote(user_id=user.id, **body.model_dump()))


@router.put("/sticky-notes/{item_id}", response_model=StickyRead)
def update_sticky(
    item_id: uuid.UUID,
    body: StickyWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sticky = owned(db, StickyNote, item_id, user.id)
    editable(sticky)
    sticky.content, sticky.color_token = body.content, body.color_token
    return save(db, sticky)


@router.post("/sticky-notes/{item_id}/archive", response_model=StickyRead)
def archive_sticky(
    item_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sticky = owned(db, StickyNote, item_id, user.id)
    sticky.archived_at = sticky.archived_at or datetime.now(UTC)
    return save(db, sticky)


@router.post(
    "/sticky-notes/{item_id}/promote", response_model=NoteRead, status_code=201
)
def promote_sticky(
    item_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sticky = (
        db.query(StickyNote)
        .filter(StickyNote.id == item_id, StickyNote.user_id == user.id)
        .with_for_update()
        .first()
    )
    if sticky is None:
        raise HTTPException(404, "Item not found")
    editable(sticky)
    note = Note(
        user_id=user.id,
        title=sticky.content.splitlines()[0][:120],
        content=[{"type": "paragraph", "content": sticky.content}],
    )
    db.add(note)
    db.flush()
    # Carry connections to the durable note, preserving their generic meaning.
    links = (
        db.query(EntityLink)
        .filter(
            EntityLink.user_id == user.id,
            or_(
                (EntityLink.source_type == "sticky_note")
                & (EntityLink.source_id == sticky.id),
                (EntityLink.target_type == "sticky_note")
                & (EntityLink.target_id == sticky.id),
            ),
        )
        .all()
    )
    for link in links:
        if link.source_type == "sticky_note" and link.source_id == sticky.id:
            target = (link.target_type, link.target_id)
        else:
            target = (link.source_type, link.source_id)
        endpoints = sorted([("note", note.id), target], key=lambda x: (x[0], str(x[1])))
        db.add(
            EntityLink(
                user_id=user.id,
                source_type=endpoints[0][0],
                source_id=endpoints[0][1],
                target_type=endpoints[1][0],
                target_id=endpoints[1][1],
            )
        )
    sticky.archived_at = datetime.now(UTC)
    db.commit()
    db.refresh(note)
    return note


@router.get("/library-types", response_model=list[TypeRead])
def list_types(
    user: AuthenticatedUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    # Stable default identifiers also keep first-use initialization idempotent.
    for slug in DEFAULT_TYPES:
        type_id = uuid.uuid5(uuid.NAMESPACE_URL, f"continuum:library:{slug}")
        if db.get(LibraryType, type_id) is None:
            db.add(
                LibraryType(id=type_id, name=slug.title(), slug=slug, is_system=True)
            )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return (
        db.query(LibraryType)
        .filter(or_(LibraryType.is_system.is_(True), LibraryType.user_id == user.id))
        .order_by(LibraryType.is_system.desc(), LibraryType.name)
        .all()
    )


@router.post("/library-types", response_model=TypeRead, status_code=201)
def create_type(
    body: TypeWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slug = re.sub(r"[^\w]+", "-", body.name.lower()).strip("-")
    if not slug:
        raise HTTPException(422, "Use letters or numbers for a type name")
    duplicate = (
        db.query(LibraryType)
        .filter(
            LibraryType.slug == slug,
            or_(LibraryType.is_system.is_(True), LibraryType.user_id == user.id),
        )
        .first()
    )
    if duplicate or slug in DEFAULT_TYPES:
        raise HTTPException(409, "That Library type already exists")
    try:
        return save(
            db, LibraryType(user_id=user.id, name=body.name, slug=slug, is_system=False)
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "That Library type already exists") from None


def check_library_type(db, type_id, user_id):
    kind = (
        db.query(LibraryType)
        .filter(
            LibraryType.id == type_id,
            or_(LibraryType.is_system.is_(True), LibraryType.user_id == user_id),
        )
        .first()
    )
    if kind is None:
        raise HTTPException(404, "Library type not found")


@router.get("/library", response_model=list[LibraryRead])
def list_library(
    user: AuthenticatedUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.query(LibraryItem)
        .filter(LibraryItem.user_id == user.id)
        .order_by(LibraryItem.created_at.desc())
        .all()
    )


@router.post("/library", response_model=LibraryRead, status_code=201)
def create_library(
    body: LibraryWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    check_library_type(db, body.type_id, user.id)
    values = body.model_dump()
    values["url"] = str(body.url) if body.url else None
    return save(db, LibraryItem(user_id=user.id, **values))


@router.put("/library/{item_id}", response_model=LibraryRead)
def update_library(
    item_id: uuid.UUID,
    body: LibraryWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = owned(db, LibraryItem, item_id, user.id)
    check_library_type(db, body.type_id, user.id)
    item.title, item.type_id = body.title, body.type_id
    item.description, item.url = body.description, str(body.url) if body.url else None
    return save(db, item)


@router.get("/timeline", response_model=list[TimelineRead])
def list_timeline(
    user: AuthenticatedUser = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.query(TimelineEntry)
        .filter(TimelineEntry.user_id == user.id)
        .order_by(TimelineEntry.event_date.desc(), TimelineEntry.created_at.desc())
        .all()
    )


@router.post("/timeline", response_model=TimelineRead, status_code=201)
def create_timeline(
    body: TimelineWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return save(db, TimelineEntry(user_id=user.id, **body.model_dump()))


@router.put("/timeline/{item_id}", response_model=TimelineRead)
def update_timeline(
    item_id: uuid.UUID,
    body: TimelineWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = owned(db, TimelineEntry, item_id, user.id)
    entry.title, entry.description, entry.event_date = (
        body.title,
        body.description,
        body.event_date,
    )
    return save(db, entry)


@router.get("/links", response_model=list[LinkRead])
def list_links(
    entity_type: EntityType | None = None,
    entity_id: uuid.UUID | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(EntityLink).filter(EntityLink.user_id == user.id)
    if entity_type is not None and entity_id is not None:
        owned(db, LINK_TABLES[entity_type], entity_id, user.id)
        query = query.filter(
            or_(
                (EntityLink.source_type == entity_type)
                & (EntityLink.source_id == entity_id),
                (EntityLink.target_type == entity_type)
                & (EntityLink.target_id == entity_id),
            )
        )
    elif entity_type is not None or entity_id is not None:
        raise HTTPException(422, "Provide both entity_type and entity_id")
    return query.order_by(EntityLink.created_at).all()


@router.post("/links", response_model=LinkRead, status_code=201)
def create_link(
    body: LinkWrite,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned(db, LINK_TABLES[body.source_type], body.source_id, user.id)
    owned(db, LINK_TABLES[body.target_type], body.target_id, user.id)
    endpoints = sorted(
        [(body.source_type, body.source_id), (body.target_type, body.target_id)],
        key=lambda x: (x[0], str(x[1])),
    )
    if endpoints[0] == endpoints[1]:
        raise HTTPException(422, "Choose a different item to connect")
    values = dict(
        user_id=user.id,
        source_type=endpoints[0][0],
        source_id=endpoints[0][1],
        target_type=endpoints[1][0],
        target_id=endpoints[1][1],
    )
    existing = db.query(EntityLink).filter_by(**values).first()
    if existing:
        return existing
    try:
        return save(db, EntityLink(**values))
    except IntegrityError:
        db.rollback()
        return db.query(EntityLink).filter_by(**values).one()


@router.delete("/links/{link_id}", status_code=204)
def unlink(
    link_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Removing an optional connection never deletes either entity.
    link = owned(db, EntityLink, link_id, user.id)
    db.delete(link)
    db.commit()
