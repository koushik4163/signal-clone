import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession, joinedload
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.conversation import Conversation, ConversationParticipant, ConversationType, ParticipantRole
from app.models.message import Message, MessageReceipt, MessageStatus
from app.core.security import get_current_user
from app.core.ws_manager import manager
from app.schemas.conversation import (
    ConversationCreateDirect,
    ConversationCreateGroup,
    ConversationOut,
    ParticipantOut,
    LastMessagePreview,
    GroupMemberAction,
)
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _presence_is_online(user: User) -> bool:
    if manager.is_online(user.id):
        return True
    if not user.is_online or not user.last_seen:
        return False
    last_seen = user.last_seen
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=datetime.timezone.utc)
    age_seconds = (datetime.datetime.now(datetime.timezone.utc) - last_seen).total_seconds()
    return age_seconds <= 60


def _user_out(user: User) -> UserOut:
    return UserOut.model_validate({
        "id": user.id,
        "phone_number": user.phone_number,
        "username": user.username,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "about": user.about,
        "is_online": _presence_is_online(user),
        "last_seen": user.last_seen.isoformat() if user.last_seen else None,
    })


def _get_other_participant_ids(db: DBSession, conversation_id: str, exclude_user_id: str) -> list[str]:
    rows = (
        db.query(ConversationParticipant.user_id)
        .filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id != exclude_user_id,
        )
        .all()
    )
    return [r.user_id for r in rows]


def _serialize_conversation(conv: Conversation, current_user_id: str, db: DBSession) -> ConversationOut:
    participants = [
        ParticipantOut(user=_user_out(p.user), role=p.role.value if hasattr(p.role, "value") else p.role)
        for p in conv.participants
    ]

    last_msg = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(desc(Message.created_at))
        .first()
    )
    last_message_preview = None
    if last_msg:
        last_message_preview = LastMessagePreview(
            content=last_msg.content,
            sender_id=last_msg.sender_id,
            created_at=last_msg.created_at.isoformat(),
            status=last_msg.status.value if hasattr(last_msg.status, "value") else last_msg.status,
        )

    my_participant = next((p for p in conv.participants if p.user_id == current_user_id), None)
    unread_count = 0
    if my_participant:
        q = db.query(Message).filter(
            Message.conversation_id == conv.id,
            Message.sender_id != current_user_id,
        )
        if my_participant.last_read_message_id:
            last_read = db.query(Message).filter(Message.id == my_participant.last_read_message_id).first()
            if last_read:
                q = q.filter(Message.created_at > last_read.created_at)
        unread_count = q.count()

    # direct conversation display name/avatar = other participant's
    display_name = conv.name
    display_avatar = conv.avatar_url
    if conv.type == ConversationType.direct:
        other = next((p.user for p in conv.participants if p.user_id != current_user_id), None)
        if other:
            display_name = other.display_name
            display_avatar = other.avatar_url

    return ConversationOut(
        id=conv.id,
        type=conv.type.value if hasattr(conv.type, "value") else conv.type,
        name=display_name,
        avatar_url=display_avatar,
        last_message_at=conv.last_message_at.isoformat(),
        participants=participants,
        last_message=last_message_preview,
        unread_count=unread_count,
    )


@router.get("", response_model=list[ConversationOut])
def list_conversations(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    conv_ids = [
        row.conversation_id
        for row in db.query(ConversationParticipant.conversation_id)
        .filter(ConversationParticipant.user_id == current_user.id)
        .all()
    ]
    convs = (
        db.query(Conversation)
        .options(joinedload(Conversation.participants).joinedload(ConversationParticipant.user))
        .filter(Conversation.id.in_(conv_ids))
        .order_by(desc(Conversation.last_message_at))
        .all()
    )
    return [_serialize_conversation(c, current_user.id, db) for c in convs]


@router.post("/direct", response_model=ConversationOut)
def create_direct_conversation(
    payload: ConversationCreateDirect,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if payload.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start a conversation with yourself")
    other = db.query(User).filter(User.id == payload.user_id).first()
    if not other:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if a direct conversation already exists between these two users
    my_conv_ids = {
        row.conversation_id
        for row in db.query(ConversationParticipant.conversation_id)
        .filter(ConversationParticipant.user_id == current_user.id)
        .all()
    }
    other_conv_ids = {
        row.conversation_id
        for row in db.query(ConversationParticipant.conversation_id)
        .filter(ConversationParticipant.user_id == other.id)
        .all()
    }
    shared = my_conv_ids & other_conv_ids
    if shared:
        existing = (
            db.query(Conversation)
            .filter(Conversation.id.in_(shared), Conversation.type == ConversationType.direct)
            .first()
        )
        if existing:
            return _serialize_conversation(existing, current_user.id, db)

    conv = Conversation(type=ConversationType.direct, created_by=current_user.id)
    db.add(conv)
    db.flush()
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=current_user.id, role=ParticipantRole.member))
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=other.id, role=ParticipantRole.member))
    db.commit()
    db.refresh(conv)
    return _serialize_conversation(conv, current_user.id, db)


@router.post("/group", response_model=ConversationOut)
def create_group_conversation(
    payload: ConversationCreateGroup,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Group name is required")

    member_ids = set(payload.member_ids) - {current_user.id}
    if len(member_ids) < 1:
        raise HTTPException(status_code=400, detail="Group needs at least one other member")

    members = db.query(User).filter(User.id.in_(member_ids)).all()
    if len(members) != len(member_ids):
        raise HTTPException(status_code=404, detail="One or more users not found")

    conv = Conversation(type=ConversationType.group, name=payload.name, avatar_url=payload.avatar_url, created_by=current_user.id)
    db.add(conv)
    db.flush()
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=current_user.id, role=ParticipantRole.admin))
    for uid in member_ids:
        db.add(ConversationParticipant(conversation_id=conv.id, user_id=uid, role=ParticipantRole.member))
    db.commit()
    db.refresh(conv)
    return _serialize_conversation(conv, current_user.id, db)


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    conv = _get_conv_for_member(db, conversation_id, current_user.id)
    return _serialize_conversation(conv, current_user.id, db)


def _get_conv_for_member(db: DBSession, conversation_id: str, user_id: str) -> Conversation:
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    is_member = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == user_id,
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    return conv


@router.post("/{conversation_id}/members", response_model=ConversationOut)
def add_member(
    conversation_id: str,
    payload: GroupMemberAction,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    conv = _get_conv_for_member(db, conversation_id, current_user.id)
    if conv.type != ConversationType.group:
        raise HTTPException(status_code=400, detail="Not a group conversation")

    my_part = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == current_user.id,
    ).first()
    if my_part.role != ParticipantRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can add members")

    target = db.query(User).filter(User.id == payload.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == payload.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already in group")

    db.add(ConversationParticipant(conversation_id=conversation_id, user_id=payload.user_id, role=ParticipantRole.member))
    db.commit()
    db.refresh(conv)
    return _serialize_conversation(conv, current_user.id, db)


@router.delete("/{conversation_id}/members/{user_id}", response_model=ConversationOut)
def remove_member(
    conversation_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    conv = _get_conv_for_member(db, conversation_id, current_user.id)
    if conv.type != ConversationType.group:
        raise HTTPException(status_code=400, detail="Not a group conversation")

    my_part = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == current_user.id,
    ).first()
    # allow self-removal (leave group) or admin removing others
    if user_id != current_user.id and my_part.role != ParticipantRole.admin:
        raise HTTPException(status_code=403, detail="Only admins can remove members")

    target_part = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == user_id,
    ).first()
    if not target_part:
        raise HTTPException(status_code=404, detail="User not in group")

    db.delete(target_part)
    db.commit()
    db.refresh(conv)
    return _serialize_conversation(conv, current_user.id, db)


@router.post("/{conversation_id}/read")
async def mark_read(conversation_id: str, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    conv = _get_conv_for_member(db, conversation_id, current_user.id)
    last_msg = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(desc(Message.created_at))
        .first()
    )
    my_part = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id,
        ConversationParticipant.user_id == current_user.id,
    ).first()
    if last_msg:
        my_part.last_read_message_id = last_msg.id

        # Find messages not sent by me that I haven't read yet
        unread_msgs = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user.id,
        ).all()

        updated_msg_ids = []
        for m in unread_msgs:
            # Update per-user receipt
            receipt = db.query(MessageReceipt).filter(
                MessageReceipt.message_id == m.id,
                MessageReceipt.user_id == current_user.id,
            ).first()
            if receipt and receipt.status != MessageStatus.read:
                receipt.status = MessageStatus.read
                receipt.updated_at = datetime.datetime.now(datetime.timezone.utc)
                updated_msg_ids.append(m.id)
            elif not receipt:
                db.add(MessageReceipt(
                    message_id=m.id,
                    user_id=current_user.id,
                    status=MessageStatus.read,
                ))
                updated_msg_ids.append(m.id)

            # Update Message.status based on whether ALL recipients have read
            # For direct chats, just mark as read. For groups, check all receipts.
            if conv.type == ConversationType.direct:
                m.status = MessageStatus.read
            else:
                # In group: only mark message as 'read' if all recipients have read
                other_participants = _get_other_participant_ids(db, conversation_id, m.sender_id)
                all_read = True
                for pid in other_participants:
                    r = db.query(MessageReceipt).filter(
                        MessageReceipt.message_id == m.id,
                        MessageReceipt.user_id == pid,
                    ).first()
                    if not r or r.status != MessageStatus.read:
                        all_read = False
                        break
                if all_read:
                    m.status = MessageStatus.read

        db.commit()

        # Notify senders via websocket
        if updated_msg_ids:
            senders = {m.sender_id for m in unread_msgs if m.id in updated_msg_ids}
            for sender_id in senders:
                await manager.send_to_user(sender_id, {
                    "type": "read_receipt",
                    "conversation_id": conversation_id,
                    "reader_id": current_user.id,
                    "message_ids": [m.id for m in unread_msgs if m.sender_id == sender_id and m.id in updated_msg_ids],
                })
    return {"message": "Marked as read"}
