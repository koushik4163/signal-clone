import json
import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session as DBSession

from app.database import SessionLocal
from app.core.security import get_user_from_token
from app.core.ws_manager import manager
from app.models.conversation import Conversation, ConversationParticipant
from app.models.message import Message, MessageReceipt, MessageStatus
from app.models.user import User

router = APIRouter()


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


def _get_all_participant_ids(db: DBSession, conversation_id: str) -> list[str]:
    rows = (
        db.query(ConversationParticipant.user_id)
        .filter(ConversationParticipant.conversation_id == conversation_id)
        .all()
    )
    return [r.user_id for r in rows]


async def _retroactive_deliver(user_id: str):
    """When a user connects, upgrade any 'sent' messages addressed to them to 'delivered'."""
    db = SessionLocal()
    try:
        # Find conversations this user is part of
        conv_ids = [
            r.conversation_id for r in db.query(ConversationParticipant.conversation_id)
            .filter(ConversationParticipant.user_id == user_id).all()
        ]
        if not conv_ids:
            return

        # Find messages in those conversations that are 'sent' and not sent by this user
        sent_messages = (
            db.query(Message)
            .filter(
                Message.conversation_id.in_(conv_ids),
                Message.sender_id != user_id,
                Message.status == MessageStatus.sent,
            )
            .all()
        )

        if not sent_messages:
            return

        senders_to_notify = {}  # sender_id -> list of message info
        for msg in sent_messages:
            msg.status = MessageStatus.delivered
            # Update or create receipt
            receipt = db.query(MessageReceipt).filter(
                MessageReceipt.message_id == msg.id,
                MessageReceipt.user_id == user_id,
            ).first()
            if receipt:
                receipt.status = MessageStatus.delivered
                receipt.updated_at = datetime.datetime.now(datetime.timezone.utc)
            else:
                db.add(MessageReceipt(
                    message_id=msg.id,
                    user_id=user_id,
                    status=MessageStatus.delivered,
                ))
            if msg.sender_id not in senders_to_notify:
                senders_to_notify[msg.sender_id] = []
            senders_to_notify[msg.sender_id].append({
                "id": msg.id,
                "conversation_id": msg.conversation_id,
            })

        db.commit()

        # Notify senders that their messages were delivered
        for sender_id, msgs in senders_to_notify.items():
            for conv_id in set(m["conversation_id"] for m in msgs):
                conv_msg_ids = [m["id"] for m in msgs if m["conversation_id"] == conv_id]
                await manager.send_to_user(sender_id, {
                    "type": "delivery_update",
                    "conversation_id": conv_id,
                    "message_ids": conv_msg_ids,
                    "status": "delivered",
                })
    finally:
        db.close()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Auth check with a short-lived session
    db = SessionLocal()
    try:
        user = get_user_from_token(db, token)
        if not user:
            await websocket.close(code=4001, reason="Unauthorized")
            return
        user_id = user.id
        # Mark online
        user.is_online = True
        user.last_seen = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        # Get peer IDs for presence broadcast
        conv_ids = [r.conversation_id for r in db.query(ConversationParticipant.conversation_id).filter(
            ConversationParticipant.user_id == user_id).all()]
        peer_ids = set()
        for cid in conv_ids:
            peer_ids.update(_get_other_participant_ids(db, cid, user_id))
        peer_ids_list = list(peer_ids)
    finally:
        db.close()

    await manager.connect(user_id, websocket)

    # Broadcast online presence
    await manager.broadcast_to_users(peer_ids_list, {
        "type": "presence",
        "user_id": user_id,
        "is_online": True,
    })

    # Retroactively deliver any pending 'sent' messages
    await _retroactive_deliver(user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            event_type = data.get("type")

            if event_type == "send_message":
                await _handle_send_message(user_id, data)
            elif event_type == "typing":
                await _handle_typing(user_id, data)
            elif event_type == "ping":
                await manager.send_to_user(user_id, {"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, websocket)
        # If no more connections for this user, mark offline
        if not manager.is_online(user_id):
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    user.is_online = False
                    user.last_seen = datetime.datetime.now(datetime.timezone.utc)
                    db.commit()
            finally:
                db.close()
            # Recompute peer_ids for disconnect broadcast
            db = SessionLocal()
            try:
                conv_ids = [r.conversation_id for r in db.query(ConversationParticipant.conversation_id).filter(
                    ConversationParticipant.user_id == user_id).all()]
                current_peer_ids = set()
                for cid in conv_ids:
                    current_peer_ids.update(_get_other_participant_ids(db, cid, user_id))
            finally:
                db.close()
            await manager.broadcast_to_users(list(current_peer_ids), {
                "type": "presence",
                "user_id": user_id,
                "is_online": False,
                "last_seen": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            })


async def _handle_send_message(user_id: str, data: dict):
    conversation_id = data.get("conversation_id")
    content = (data.get("content") or "").strip()
    reply_to_id = data.get("reply_to_id")
    client_temp_id = data.get("client_temp_id")

    if not conversation_id or not content:
        return

    db = SessionLocal()
    try:
        is_member = db.query(ConversationParticipant).filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        ).first()
        if not is_member:
            await manager.send_to_user(user_id, {"type": "error", "message": "Not a participant"})
            return

        others = _get_other_participant_ids(db, conversation_id, user_id)
        initial_status = MessageStatus.delivered if any(manager.is_online(uid) for uid in others) else MessageStatus.sent

        msg = Message(
            conversation_id=conversation_id,
            sender_id=user_id,
            content=content,
            status=initial_status,
            reply_to_id=reply_to_id,
        )
        db.add(msg)

        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        conv.last_message_at = datetime.datetime.now(datetime.timezone.utc)

        db.commit()
        db.refresh(msg)

        # Create per-user receipts
        for uid in others:
            db.add(MessageReceipt(
                message_id=msg.id,
                user_id=uid,
                status=MessageStatus.delivered if manager.is_online(uid) else MessageStatus.sent,
            ))
        db.commit()

        payload = {
            "type": "new_message",
            "message": {
                "id": msg.id,
                "conversation_id": msg.conversation_id,
                "sender_id": msg.sender_id,
                "content": msg.content,
                "status": msg.status.value,
                "reply_to_id": msg.reply_to_id,
                "created_at": msg.created_at.isoformat(),
                "client_temp_id": client_temp_id,
            },
        }

        # Echo back to sender
        await manager.send_to_user(user_id, payload)
        # Deliver to other participants
        await manager.broadcast_to_users(others, payload)
    finally:
        db.close()


async def _handle_typing(user_id: str, data: dict):
    conversation_id = data.get("conversation_id")
    is_typing = bool(data.get("is_typing"))
    if not conversation_id:
        return
    db = SessionLocal()
    try:
        # Verify sender is a participant
        is_member = db.query(ConversationParticipant).filter(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        ).first()
        if not is_member:
            return
        others = _get_other_participant_ids(db, conversation_id, user_id)
    finally:
        db.close()
    await manager.broadcast_to_users(others, {
        "type": "typing",
        "conversation_id": conversation_id,
        "user_id": user_id,
        "is_typing": is_typing,
    })
