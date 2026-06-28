import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../store/auth';
import { getSessionDetail } from '../../api/sessions';
import { getReviews, submitReview } from '../../api/reviews';
import { StarRating } from '../../components/common/StarRating';
import { ReviewTag } from '../../components/common/ReviewTag';
import { showToast } from '../../components/common/Toast';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import type { Session } from '../../types';

const TAG_OPTIONS = ['推理烧脑', '情感催泪', 'DM入戏深', '氛围感强', '欢乐撕逼', '机制有趣'];

export const ReviewPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (sessionId) {
      getSessionDetail(Number(sessionId)).then(setSession).catch(() => setSession(null));
    }
  }, [sessionId]);

  const [dmRating, setDmRating] = useState(0);
  const [scriptRating, setScriptRating] = useState(0);
  const [roomRating, setRoomRating] = useState(0);
  const [overallRating, setOverallRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // ===== 检查是否已评价 =====
  const { data: existingReviews } = useDataFetch({
    fetcher: (_signal) => getReviews({ session_id: Number(sessionId) }),
  });

  const existingReview = existingReviews?.find(
    (r: any) => r.Reviewer_User_ID === user?.User_ID
  );

  // ===== 提交评价 Mutation =====
  const { execute: doSubmit, loading: submitting } = useApiMutation({
    apiFn: (data: {
      Session_ID: number; DM_Rating: number; Script_Rating: number;
      Room_Rating: number; Overall_Rating: number;
      Review_Comment?: string; Tags?: string; Is_Anonymous?: boolean;
    }) => submitReview(data),
    successMessage: '评价提交成功！',
  });

  useEffect(() => {
    if (!user || !session) return;
    // 检查场次是否已完成
    if (session.Session_Status !== 'Completed') {
      showToast('仅可对已完成的场次进行评价', 'error');
      navigate(-1);
    }
  }, [user, session, navigate]);

  const handleSubmit = async () => {
    if (dmRating === 0 || scriptRating === 0 || roomRating === 0 || overallRating === 0) {
      showToast('请完成所有评分', 'error');
      return;
    }
    const result = await doSubmit({
      Session_ID: Number(sessionId),
      DM_Rating: dmRating,
      Script_Rating: scriptRating,
      Room_Rating: roomRating,
      Overall_Rating: overallRating,
      Review_Comment: comment || undefined,
      Tags: selectedTags.join(','),
      Is_Anonymous: isAnonymous,
    });
    if (result) {
      setTimeout(() => navigate(-1), 1000);
    }
  };

  if (!session) {
    return <div className="py-16 text-center text-gray-400">场次不存在</div>;
  }

  if (existingReview) {
    return (
      <div className="py-8 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">评价已提交</h2>
        <div className="card text-center py-8">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-600">你已经对《{session.Script_Title}》场次进行过评价</p>
          <p className="text-sm text-gray-400 mt-1">综合评分: {existingReview.Overall_Rating} 分</p>
          <button onClick={() => navigate(-1)} className="btn-secondary mt-4 text-sm">返回</button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold text-gray-900">场次评价</h2>
      <p className="text-sm text-gray-500">{session.Script_Title} · {session.DM_Stage_Name} · {session.Room_Name}</p>

      {/* 评分 */}
      <div className="card space-y-3">
        <StarRating label="DM" value={dmRating} onChange={setDmRating} size="lg" />
        <StarRating label="剧本" value={scriptRating} onChange={setScriptRating} size="lg" />
        <StarRating label="房间" value={roomRating} onChange={setRoomRating} size="lg" />
        <StarRating label="综合" value={overallRating} onChange={setOverallRating} size="lg" />
      </div>

      {/* 标签 */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-2">标签 (可多选)</h3>
        <ReviewTag tags={TAG_OPTIONS} selected={selectedTags} onToggle={tag => {
          setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
        }} />
      </div>

      {/* 文字评价 */}
      <div className="card">
        <label className="text-sm font-medium text-gray-700 block mb-2">评价内容 (选填)</label>
        <textarea
          className="input-field w-full min-h-[80px] text-sm resize-none"
          placeholder="分享你的体验..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          maxLength={500}
        />
        <p className="text-[12px] text-gray-400 text-right mt-1">{comment.length}/500</p>
      </div>

      {/* 匿名 */}
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
        <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)}
          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
        匿名评价
      </label>

      {/* 提交 */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="btn-primary w-full py-3 text-base disabled:opacity-50">
        {submitting ? '提交中...' : '提交评价'}
      </button>
    </div>
  );
};
