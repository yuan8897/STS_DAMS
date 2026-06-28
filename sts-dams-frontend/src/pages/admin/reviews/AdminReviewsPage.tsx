import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../../utils/format';
import { getReviews } from '../../../api/reviews';
import { StarRating } from '../../../components/common/StarRating';
import { useDataFetch } from '../../../hooks/useDataFetch';
import type { SessionReview } from '../../../types';

export const AdminReviewsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterDM, setFilterDM] = useState('all');
  const [filterScript, setFilterScript] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  // Store replies locally: Map<Review_ID, reply_content>
  const [replies, setReplies] = useState<Map<number, string>>(new Map());

  const handleSaveReply = (reviewId: number) => {
    if (!replyText.trim()) return;
    setReplies(prev => new Map(prev).set(reviewId, replyText.trim()));
    setReplyText('');
    setReplyingId(null);
  };

  // ====== Data fetch ======
  const { data: reviews = [] } = useDataFetch<SessionReview[]>({
    fetcher: (_signal: AbortSignal) => getReviews(),
  });

  // Compute unique DMs from review data
  const dms = useMemo(() => {
    const map = new Map<number, { DM_User_ID: number; DM_Stage_Name: string }>();
    (reviews || []).forEach(r => {
      if (r.DM_User_ID && !map.has(r.DM_User_ID)) {
        map.set(r.DM_User_ID, { DM_User_ID: r.DM_User_ID, DM_Stage_Name: r.DM_Stage_Name || '' });
      }
    });
    return Array.from(map.values());
  }, [reviews]);

  // Compute unique scripts from review data
  const scripts = useMemo(() => {
    return [...new Set((reviews || []).map(r => r.Script_Title))];
  }, [reviews]);

  // Compute DM stats from review data
  const dmStats = useMemo(() => {
    const map = new Map<number, { DM_User_ID: number; DM_Stage_Name: string; Total_Reviews: number; Avg_Overall_Rating: number }>();
    const totals = new Map<number, number>();
    (reviews || []).forEach(r => {
      const dmId = r.DM_User_ID;
      if (!dmId) return;
      if (!map.has(dmId)) {
        map.set(dmId, { DM_User_ID: dmId, DM_Stage_Name: r.DM_Stage_Name || '', Total_Reviews: 0, Avg_Overall_Rating: 0 });
        totals.set(dmId, 0);
      }
      const entry = map.get(dmId)!;
      entry.Total_Reviews++;
      totals.set(dmId, (totals.get(dmId) || 0) + r.Overall_Rating);
    });
    map.forEach((entry, id) => {
      entry.Avg_Overall_Rating = entry.Total_Reviews > 0 ? (totals.get(id) || 0) / entry.Total_Reviews : 0;
    });
    return Array.from(map.values());
  }, [reviews]);

  let filtered = reviews || [];
  if (filterDM !== 'all') filtered = filtered.filter(r => r.DM_User_ID === Number(filterDM));
  if (filterScript !== 'all') filtered = filtered.filter(r => r.Script_Title === filterScript);
  if (filterRating === 'low') filtered = filtered.filter(r => r.Overall_Rating < 3);

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">评价管理</h2>

      {/* 筛选 */}
      <div className="flex flex-wrap gap-2">
        <select className="input-field text-xs py-1" value={filterDM}
          onChange={e => setFilterDM(e.target.value)}>
          <option value="all">全部 DM</option>
          {dms.map(dm => (
            <option key={dm.DM_User_ID} value={dm.DM_User_ID}>{dm.DM_Stage_Name}</option>
          ))}
        </select>
        <select className="input-field text-xs py-1" value={filterScript}
          onChange={e => setFilterScript(e.target.value)}>
          <option value="all">全部剧本</option>
          {scripts.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input-field text-xs py-1" value={filterRating}
          onChange={e => setFilterRating(e.target.value)}>
          <option value="all">全部评分</option>
          <option value="low">低分预警 (&lt;3分)</option>
        </select>
      </div>

      {/* 评价列表 */}
      <div className="space-y-2">
        {filtered.map(review => (
          <div key={review.Review_ID}
            className={`card ${review.Overall_Rating < 3 ? 'border-red-200 bg-red-50' : ''}`}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">
                    {review.Is_Anonymous ? '匿名玩家' : (review.Reviewer_Name || '玩家')}
                  </span>
                  <span className="text-xs text-gray-400">{review.Script_Title}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  DM: {review.DM_Stage_Name} · {formatDateTime(review.Created_At)}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <StarRating value={review.Overall_Rating} readonly size="sm" />
              </div>
            </div>
            {review.Review_Comment && (
              <p className="text-sm text-gray-600 mt-1">{review.Review_Comment}</p>
            )}
            {review.Tags && (
              <div className="flex flex-wrap gap-1 mt-1">
                {review.Tags.split(',').map((tag, i) => (
                  <span key={i} className="text-[12px] px-2 py-0.5 rounded bg-purple-50 text-purple-600">{tag.trim()}</span>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-2 text-xs text-gray-400">
              <span>DM: {review.DM_Rating}分</span>
              <span>剧本: {review.Script_Rating}分</span>
              <span>房间: {review.Room_Rating}分</span>
            </div>

            {/* 回复板块 */}
            {replies.has(review.Review_ID) && (
              <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-[12px] font-medium text-blue-600">🏪 店长回复:</span>
                <p className="text-xs text-blue-800 mt-0.5">{replies.get(review.Review_ID)}</p>
              </div>
            )}

            {replyingId === review.Review_ID ? (
              <div className="mt-2 space-y-1.5">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="输入店长回复..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none h-16 focus:outline-none focus:border-purple-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveReply(review.Review_ID)}
                    className="text-xs bg-accent-purple text-white px-3 py-1 rounded-lg hover:bg-purple-700"
                  >
                    保存回复
                  </button>
                  <button
                    onClick={() => { setReplyingId(null); setReplyText(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setReplyingId(review.Review_ID);
                  setReplyText(replies.get(review.Review_ID) || '');
                }}
                className="mt-2 text-xs text-accent-purple hover:text-purple-700 font-medium"
              >
                {replies.has(review.Review_ID) ? '✏️ 编辑回复' : '💬 回复'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* DM 评分汇总 */}
      <div className="card">
        <h3 className="font-semibold text-sm text-gray-900 mb-2">DM 评分汇总</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {dmStats.map(dm => (
            <div key={dm.DM_User_ID}
              onClick={() => navigate(`/admin/reviews/dm/${dm.DM_User_ID}`)}
              className="p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all">
              <div className="font-medium text-sm">{dm.DM_Stage_Name}</div>
              <div className="flex items-center gap-1 mt-1">
                <StarRating value={Math.round(dm.Avg_Overall_Rating)} readonly size="sm" />
                <span className="text-xs text-gray-500 ml-1">
                  {dm.Avg_Overall_Rating.toFixed(1)}
                </span>
              </div>
              <div className="text-[12px] text-gray-400 mt-0.5">{dm.Total_Reviews} 条评价</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
