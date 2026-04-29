import uuid as _uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[_uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=_uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    actor_id: Mapped[Optional[_uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_name: Mapped[str] = mapped_column(String(200), nullable=False, default="System")

    # e.g. create / update / delete / restore / import / export / approve / reject / login
    action: Mapped[str] = mapped_column(String(50), nullable=False)

    # e.g. task / employee / product / invoice / batch / platform_order / role
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    entity_name: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)

    # Human-readable full description shown in the UI
    description: Mapped[str] = mapped_column(Text, nullable=False)

    # For deleted records — JSON snapshot so Super Admin can restore
    deleted_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
