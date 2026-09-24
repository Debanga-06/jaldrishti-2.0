"""
Community Feedback Router for JALDRISHTI.
Provides MongoDB-backed persistent storage for citizen waterlogging reports, photos,
threaded replies, mutual Like/Dislike reactions, and strict user ownership deletion checks.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from app.api.v1.endpoints.auth import get_current_user_from_token
from app.database.mongodb import get_database

router = APIRouter(prefix="/feedback", tags=["Community Feedback"])

class CreateFeedbackPayload(BaseModel):
    spotId: str
    text: str
    photoUrl: Optional[str] = None

class CreateReplyPayload(BaseModel):
    text: str

class ToggleReactionPayload(BaseModel):
    reactionType: str  # "LIKE" or "DISLIKE"

def format_feedback_item(fb: dict, current_user_id: Optional[str] = None) -> dict:
    """Formats raw MongoDB feedback document for frontend consumption."""
    fb_id = fb.get("feedbackId") or str(fb.get("_id"))
    reactions = fb.get("reactions", [])
    
    likes_count = sum(1 for r in reactions if r.get("type") == "LIKE")
    dislikes_count = sum(1 for r in reactions if r.get("type") == "DISLIKE")
    
    user_reaction = None
    if current_user_id:
        for r in reactions:
            if r.get("userId") == current_user_id:
                user_reaction = r.get("type")
                break

    formatted_replies = []
    for rep in fb.get("replies", []):
        rep_reactions = rep.get("reactions", [])
        rep_likes = sum(1 for r in rep_reactions if r.get("type") == "LIKE")
        rep_dislikes = sum(1 for r in rep_reactions if r.get("type") == "DISLIKE")
        rep_user_reaction = None
        if current_user_id:
            for r in rep_reactions:
                if r.get("userId") == current_user_id:
                    rep_user_reaction = r.get("type")
                    break

        formatted_replies.append({
            "id": rep.get("replyId"),
            "userId": rep.get("userId"),
            "userEmail": rep.get("userEmail"),
            "userName": rep.get("userName") or rep.get("userEmail", "").split("@")[0] or "Resident",
            "text": rep.get("text"),
            "timestamp": rep.get("timestamp"),
            "likes": rep_likes,
            "likedBy": [r.get("userEmail") for r in rep_reactions if r.get("type") == "LIKE"],
            "dislikes": rep_dislikes,
            "dislikedBy": [r.get("userEmail") for r in rep_reactions if r.get("type") == "DISLIKE"],
        })

    return {
        "id": fb_id,
        "spotId": fb.get("spotId"),
        "userId": fb.get("userId"),
        "userEmail": fb.get("userEmail"),
        "userName": fb.get("userName") or fb.get("userEmail", "").split("@")[0] or "Verified Citizen",
        "text": fb.get("text"),
        "photoUrl": fb.get("photoUrl"),
        "depthCategory": fb.get("depthCategory", "ACTIVE WATERLOGGING"),
        "depthCm": fb.get("depthCm", 15),
        "timestamp": fb.get("timestamp"),
        "dateGroup": fb.get("dateGroup", "TODAY"),
        "status": fb.get("status", "ACTIVE"),
        "likes": likes_count,
        "likedBy": [r.get("userEmail") for r in reactions if r.get("type") == "LIKE"],
        "dislikes": dislikes_count,
        "dislikedBy": [r.get("userEmail") for r in reactions if r.get("type") == "DISLIKE"],
        "replies": formatted_replies
    }

@router.get("")
async def get_all_feedbacks():
    """Retrieves all community feedback records from MongoDB grouped by spotId."""
    db = get_database()
    cursor = db.feedbacks.find({})
    feedbacks_by_spot: Dict[str, List[dict]] = {}
    
    async for doc in cursor:
        spot_id = doc.get("spotId", "road_102")
        if spot_id not in feedbacks_by_spot:
            feedbacks_by_spot[spot_id] = []
        feedbacks_by_spot[spot_id].append(format_feedback_item(doc))
        
    return {"success": True, "communityFeedbacks": feedbacks_by_spot}

@router.post("")
async def create_feedback(payload: CreateFeedbackPayload, user: dict = Depends(get_current_user_from_token)):
    """Creates a new community feedback record in MongoDB Atlas."""
    db = get_database()
    now_iso = datetime.now(timezone.utc).isoformat()
    feedback_id = f"FB-{uuid.uuid4().hex[:10].upper()}"

    doc = {
        "feedbackId": feedback_id,
        "spotId": payload.spotId,
        "userId": user["userId"],
        "userEmail": user["email"],
        "userName": user.get("name") or user["email"].split("@")[0],
        "text": payload.text,
        "photoUrl": payload.photoUrl,
        "depthCategory": "ACTIVE WATERLOGGING",
        "depthCm": 18,
        "timestamp": "Just now",
        "dateGroup": "TODAY",
        "status": "ACTIVE",
        "reactions": [],
        "replies": [],
        "createdAt": now_iso,
        "updatedAt": now_iso
    }

    await db.feedbacks.insert_one(doc)
    return {"success": True, "feedback": format_feedback_item(doc, user["userId"])}

@router.delete("/{feedback_id}")
async def delete_feedback(feedback_id: str, user: dict = Depends(get_current_user_from_token)):
    """Deletes feedback document strictly verifying user ownership."""
    db = get_database()
    fb = await db.feedbacks.find_one({"feedbackId": feedback_id})
    if not fb:
        raise HTTPException(status_code=404, detail="Community feedback not found.")
    
    if fb["userId"] != user["userId"]:
        raise HTTPException(status_code=403, detail="You can only delete your own feedback.")
    
    await db.feedbacks.delete_one({"feedbackId": feedback_id})
    return {"success": True, "message": "Feedback deleted successfully."}

@router.post("/{feedback_id}/replies")
async def add_reply(feedback_id: str, payload: CreateReplyPayload, user: dict = Depends(get_current_user_from_token)):
    """Adds a reply thread to a feedback item in MongoDB Atlas."""
    db = get_database()
    fb = await db.feedbacks.find_one({"feedbackId": feedback_id})
    if not fb:
        raise HTTPException(status_code=404, detail="Community feedback not found.")
    
    reply_id = f"RPLY-{uuid.uuid4().hex[:8].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()

    reply_doc = {
        "replyId": reply_id,
        "userId": user["userId"],
        "userEmail": user["email"],
        "userName": user.get("name") or user["email"].split("@")[0],
        "text": payload.text,
        "timestamp": "Just now",
        "reactions": [],
        "createdAt": now_iso
    }

    await db.feedbacks.update_one(
        {"feedbackId": feedback_id},
        {"$push": {"replies": reply_doc}, "$set": {"updatedAt": now_iso}}
    )
    return {"success": True, "reply": reply_doc}

@router.delete("/{feedback_id}/replies/{reply_id}")
async def delete_reply(feedback_id: str, reply_id: str, user: dict = Depends(get_current_user_from_token)):
    """Deletes a reply thread strictly verifying reply author ownership."""
    db = get_database()
    fb = await db.feedbacks.find_one({"feedbackId": feedback_id})
    if not fb:
        raise HTTPException(status_code=404, detail="Community feedback not found.")
    
    target_reply = None
    for r in fb.get("replies", []):
        if r.get("replyId") == reply_id:
            target_reply = r
            break
            
    if not target_reply:
        raise HTTPException(status_code=404, detail="Reply thread not found.")
        
    if target_reply["userId"] != user["userId"]:
        raise HTTPException(status_code=403, detail="You can only delete your own reply.")
        
    await db.feedbacks.update_one(
        {"feedbackId": feedback_id},
        {"$pull": {"replies": {"replyId": reply_id}}}
    )
    return {"success": True, "message": "Reply deleted successfully."}

@router.post("/{feedback_id}/reaction")
async def toggle_feedback_reaction(feedback_id: str, payload: ToggleReactionPayload, user: dict = Depends(get_current_user_from_token)):
    """Toggles LIKE or DISLIKE reaction on feedback enforcing single choice per user."""
    db = get_database()
    fb = await db.feedbacks.find_one({"feedbackId": feedback_id})
    if not fb:
        raise HTTPException(status_code=404, detail="Community feedback not found.")
        
    reactions = fb.get("reactions", [])
    user_id = user["userId"]
    target_type = payload.reactionType.upper()
    
    if target_type not in ["LIKE", "DISLIKE"]:
        raise HTTPException(status_code=400, detail="Reaction type must be LIKE or DISLIKE.")
        
    # Remove existing reaction by user if present
    new_reactions = [r for r in reactions if r.get("userId") != user_id]
    
    # Check if user was toggling off the exact same reaction
    existing_reaction = next((r.get("type") for r in reactions if r.get("userId") == user_id), None)
    if existing_reaction != target_type:
        new_reactions.append({"userId": user_id, "userEmail": user["email"], "type": target_type})
        
    await db.feedbacks.update_one(
        {"feedbackId": feedback_id},
        {"$set": {"reactions": new_reactions}}
    )
    
    updated_fb = await db.feedbacks.find_one({"feedbackId": feedback_id})
    return {"success": True, "feedback": format_feedback_item(updated_fb, user_id)}

@router.post("/{feedback_id}/replies/{reply_id}/reaction")
async def toggle_reply_reaction(feedback_id: str, reply_id: str, payload: ToggleReactionPayload, user: dict = Depends(get_current_user_from_token)):
    """Toggles LIKE or DISLIKE reaction on a reply thread."""
    db = get_database()
    fb = await db.feedbacks.find_one({"feedbackId": feedback_id})
    if not fb:
        raise HTTPException(status_code=404, detail="Community feedback not found.")
        
    user_id = user["userId"]
    target_type = payload.reactionType.upper()
    if target_type not in ["LIKE", "DISLIKE"]:
        raise HTTPException(status_code=400, detail="Reaction type must be LIKE or DISLIKE.")
        
    replies = fb.get("replies", [])
    for rep in replies:
        if rep.get("replyId") == reply_id:
            rep_reactions = rep.get("reactions", [])
            new_rep_reactions = [r for r in rep_reactions if r.get("userId") != user_id]
            existing_type = next((r.get("type") for r in rep_reactions if r.get("userId") == user_id), None)
            if existing_type != target_type:
                new_rep_reactions.append({"userId": user_id, "userEmail": user["email"], "type": target_type})
            rep["reactions"] = new_rep_reactions
            break

    await db.feedbacks.update_one(
        {"feedbackId": feedback_id},
        {"$set": {"replies": replies}}
    )
    
    updated_fb = await db.feedbacks.find_one({"feedbackId": feedback_id})
    return {"success": True, "feedback": format_feedback_item(updated_fb, user_id)}
