import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  Image as ImageIcon,
  Send,
  X,
  AlertCircle,
  CornerDownRight,
} from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';

interface CommunityFeedbackSectionProps {
  spotId: string;
  spotName: string;
}

export const CommunityFeedbackSection: React.FC<CommunityFeedbackSectionProps> = ({ spotId, spotName }) => {
  const {
    userEmail,
    communityFeedbacks,
    addCommunityFeedback,
    deleteCommunityFeedback,
    toggleLikeCommunityFeedback,
    toggleDislikeCommunityFeedback,
    addCommunityFeedbackReply,
    deleteCommunityFeedbackReply,
    toggleLikeCommunityFeedbackReply,
    toggleDislikeCommunityFeedbackReply,
    feedbackSyncError,
    clearFeedbackSyncError,
  } = useFloodStore();

  const [text, setText] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Strict Delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    feedbackId: string;
    replyId?: string;
    isReply?: boolean;
  }>({ isOpen: false, feedbackId: '' });

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const feedbacks = communityFeedbacks[spotId] || [];

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !photoUrl) return;
    addCommunityFeedback(spotId, text, photoUrl);
    setText('');
    setPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddReply = (feedbackId: string) => {
    if (!replyText.trim()) return;
    addCommunityFeedbackReply(spotId, feedbackId, replyText);
    setReplyText('');
    setActiveReplyId(null);
  };

  const confirmDeleteAction = () => {
    if (deleteConfirmation.isReply && deleteConfirmation.replyId) {
      deleteCommunityFeedbackReply(spotId, deleteConfirmation.feedbackId, deleteConfirmation.replyId);
    } else {
      deleteCommunityFeedback(spotId, deleteConfirmation.feedbackId);
    }
    setDeleteConfirmation({ isOpen: false, feedbackId: '' });
  };

  return (
    <div id={`community-feedback-${spotId}`} className="mt-3 pt-3 border-t border-slate-200 text-xs font-sans space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
          <span>Community Feedback ({feedbacks.length})</span>
        </h5>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
          CURRENT / ACTIVE
        </span>
      </div>

      {feedbackSyncError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-900 text-[11px] rounded-xl font-medium flex items-start space-x-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <span className="flex-1">{feedbackSyncError}</span>
          <button
            type="button"
            onClick={clearFeedbackSyncError}
            className="text-rose-500 hover:text-rose-800 shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Post Feedback Form */}
      <form onSubmit={handleSubmit} className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Share live water depth or feedback for ${spotName}...`}
          rows={2}
          className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
        />

        {/* Photo Preview if attached */}
        {photoUrl && (
          <div className="relative inline-block">
            <img src={photoUrl} alt="Upload preview" className="w-20 h-20 object-cover rounded-lg border border-slate-300" />
            <button
              type="button"
              onClick={() => {
                setPhotoUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5 shadow hover:bg-rose-700"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-medium transition-colors"
          >
            <ImageIcon className="w-3 h-3 text-slate-600" />
            <span>{photoUrl ? 'Change Photo' : 'Attach Photo'}</span>
          </button>

          <button
            type="submit"
            disabled={!text.trim() && !photoUrl}
            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm"
          >
            <Send className="w-3 h-3" />
            <span>Submit</span>
          </button>
        </div>
      </form>

      {/* Feedbacks List */}
      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
        {feedbacks.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic text-center py-2">
            No community feedback submitted for this active location yet.
          </p>
        ) : (
          feedbacks.map((fb) => {
            const isOwner = fb.userEmail === userEmail;
            const hasLiked = (fb.likedBy || []).includes(userEmail);
            const hasDisliked = (fb.dislikedBy || []).includes(userEmail);

            return (
              <div key={fb.id} className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[9px] flex items-center justify-center">
                      {(fb.userName || 'U')[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-800 text-[11px]">{fb.userName || fb.userEmail}</span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {new Date(fb.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* STRICT USER OWNERSHIP: DELETE BUTTON ONLY FOR OWNER */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmation({ isOpen: true, feedbackId: fb.id, isReply: false })}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors"
                      title="Delete your feedback"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-700 font-normal leading-relaxed">{fb.text}</p>

                {fb.photoUrl && (
                  <div className="mt-1">
                    <img
                      src={fb.photoUrl}
                      alt="User submission"
                      className="max-h-36 w-full object-cover rounded-lg border border-slate-200"
                    />
                  </div>
                )}

                {/* Feedback Reactions & Actions (Like + Dislike + Reply) */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => toggleLikeCommunityFeedback(spotId, fb.id)}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded border transition-colors ${
                        hasLiked
                          ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Like this feedback"
                    >
                      <ThumbsUp className={`w-3 h-3 ${hasLiked ? 'fill-blue-600 text-blue-600' : ''}`} />
                      <span>{fb.likes || 0}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleDislikeCommunityFeedback(spotId, fb.id)}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded border transition-colors ${
                        hasDisliked
                          ? 'bg-rose-50 border-rose-200 text-rose-600 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                      title="Dislike this feedback"
                    >
                      <ThumbsDown className={`w-3 h-3 ${hasDisliked ? 'fill-rose-600 text-rose-600' : ''}`} />
                      <span>{fb.dislikes || 0}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveReplyId(activeReplyId === fb.id ? null : fb.id)}
                    className="text-blue-600 font-medium hover:underline text-[10px]"
                  >
                    Reply ({(fb.replies || []).length})
                  </button>
                </div>

                {/* Replies Thread */}
                {fb.replies && fb.replies.length > 0 && (
                  <div className="ml-3 pl-2.5 border-l-2 border-slate-200 space-y-1.5 pt-1.5">
                    {fb.replies.map((reply) => {
                      const isReplyOwner = reply.userEmail === userEmail;
                      const replyHasLiked = (reply.likedBy || []).includes(userEmail);
                      const replyHasDisliked = (reply.dislikedBy || []).includes(userEmail);

                      return (
                        <div key={reply.id} className="bg-slate-50 p-1.5 rounded-lg border border-slate-100 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 text-[10px]">{reply.userName}</span>
                            {isReplyOwner && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmation({
                                    isOpen: true,
                                    feedbackId: fb.id,
                                    replyId: reply.id,
                                    isReply: true,
                                  })
                                }
                                className="text-rose-500 hover:text-rose-700"
                                title="Delete your reply"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-700">{reply.text}</p>

                          {/* Reply Reactions (Like + Dislike) */}
                          <div className="flex items-center space-x-1.5 pt-0.5 text-[9px]">
                            <button
                              type="button"
                              onClick={() => toggleLikeCommunityFeedbackReply(spotId, fb.id, reply.id)}
                              className={`flex items-center space-x-0.5 px-1.5 py-0.5 rounded border transition-colors ${
                                replyHasLiked
                                  ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                              title="Like reply"
                            >
                              <ThumbsUp className={`w-2.5 h-2.5 ${replyHasLiked ? 'fill-blue-600 text-blue-600' : ''}`} />
                              <span>{reply.likes || 0}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleDislikeCommunityFeedbackReply(spotId, fb.id, reply.id)}
                              className={`flex items-center space-x-0.5 px-1.5 py-0.5 rounded border transition-colors ${
                                replyHasDisliked
                                  ? 'bg-rose-50 border-rose-200 text-rose-600 font-bold'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                              title="Dislike reply"
                            >
                              <ThumbsDown className={`w-2.5 h-2.5 ${replyHasDisliked ? 'fill-rose-600 text-rose-600' : ''}`} />
                              <span>{reply.dislikes || 0}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply Input Form */}
                {activeReplyId === fb.id && (
                  <div className="flex items-center space-x-1.5 pt-1.5">
                    <CornerDownRight className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 text-[11px] px-2 py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddReply(fb.id)}
                      className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700"
                    >
                      Post
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* STRICT DELETE CONFIRMATION MODAL */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-xs w-full space-y-4 text-center font-sans">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-base">Delete this feedback?</h4>
              <p className="text-xs text-slate-500">
                This report and any attached photo will be permanently deleted.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmation({ isOpen: false, feedbackId: '' })}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAction}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors shadow-md shadow-rose-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
