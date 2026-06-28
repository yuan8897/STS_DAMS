import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatDateTime } from '../../../utils/format';
import { getReviews, getDMStats as apiGetDMStats } from '../../../api/reviews';
import { StarRating } from '../../../components/common/StarRating';
import { useDataFetch } from '../../../hooks/useDataFetch';
import type { SessionReview, DMReviewStats } from '../../../types';

export const DMReviewDetailPage: React.FC = () => {
  const { dmId } = useParams<{ dmId: string }>();
  const numDmId = Number(dmId);

  // DM stage name derived from review data (fallback to ID)
  const [dmStageName, setDmStageName] = useState<string>('');
  // Reply state
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState<Map<number, string>>(new Map());

  const handleSaveReply = (reviewId: number) => {
    if (!replyText.trim()) return;
    setReplies(prev => new Map(prev).set(reviewId, replyText.trim()));
    setReplyText('');
    setReplyingId(null);
  };

  // ====== Reviews for this DM ======
  const { data: reviews = [], refresh: refreshReviews } = useDataFetch<SessionReview[]>({
    fetcher: (_signal: AbortSignal) =>
      dmId ? getReviews({ dm_id: numDmId }) : Promise.resolve([]),
  });

  // ====== DM Stats ======
  const { data: statsData, refresh: refreshStats } = useDataFetch<{
    Stats: DMReviewStats;
    Rating_Distribution: { Overall_Rating: number; Count: number }[];
  } | null>({
    fetcher: (_signal: AbortSignal) =>
      dmId ? apiGetDMStats(numDmId) : Promise.resolve(null),
  });

  // Re-fetch when dmId changes
  useEffect(() => {
    if (dmId) {
      refreshReviews();
      refreshStats();
    }
  }, [dmId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive DM stage name from review data
  useEffect(() => {
    if (reviews && reviews.length > 0 && reviews[0].DM_Stage_Name) {
      setDmStageName(reviews[0].DM_Stage_Name);
    }
  }, [reviews]);

  const stats = statsData?.Stats || null;
  const ratingDist = statsData?.Rating_Distribution || [];

  if (!dmId) return <div className="py-16 text-center text-gray-400">DM 参数错误</div>;

  const avgOverall = stats?.Avg_Overall_Rating || 0;
  const avgDM = stats?.Avg_DM_Rating || 0;

  return (
    <div className="py-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">{dmStageName || `DM #${dmId}`} - 评价详情</h2>

      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary">{stats?.Total_Reviews || 0}</p>
          <p className="text-[12px] text-gray-400 mt-1">总评价数</p>
        </div>
        <div className="card text-center">
          <StarRating value={Math.round(Number(avgOverall))} readonly size="sm" />
          <p className="text-xs text-gray-400 mt-1">{Number(avgOverall).toFixed(1)} 综合均分</p>
        </div>
        <div className="card text-center">
          <StarRating value={Math.round(Number(avgDM))} readonly size="sm" />
          <p className="text-xs text-gray-400 mt-1">{Number(avgDM).toFixed(1)} DM均分</p>
        </div>
      </div>

      {/* 评分分布 */}
      {ratingDist.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-sm text-gray-900 mb-2">评分分布</h3>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map(score => {
              const item = ratingDist.find(d => d.Overall_Rating === score);
              const count = item?.Count || 0;
              const maxCount = Math.max(...ratingDist.map(d => d.Count), 1);
              return (
                <div key={score} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-4">{score}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div className="bg-purple-400 h-3 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 评价列表 */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-gray-900">玩家评价</h3>
        {(reviews || []).map(review => (
          <div key={review.Review_ID} className="card">
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="font-medium text-sm text-gray-900">
                  {review.Is_Anonymous ? '匿名玩家' : (review.Reviewer_Name || '玩家')}
                </span>
                <span className="text-xs text-gray-400 ml-2">{review.Script_Title}</span>
              </div>
              <StarRating value={review.Overall_Rating} readonly size="sm" />
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
            <div className="flex gap-2 mt-1 text-xs text-gray-400">
              <span>DM: {review.DM_Rating}分</span>
              <span>剧本: {review.Script_Rating}分</span>
              <span>房间: {review.Room_Rating}分</span>
              <span>· {formatDateTime(review.Created_At)}</span>
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
        {(reviews || []).length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">暂无评价</p>
        )}
      </div>
    </div>
  );
};
