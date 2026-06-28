import React, { useState } from 'react';
import { getScripts, getScriptCopies, createScriptCopy, updateCopyCondition } from '../../api/scripts';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { showToast } from '../../components/common/Toast';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useApiMutation } from '../../hooks/useApiMutation';
import type { Script, ScriptCopy } from '../../types';

const CONDITION_LABELS: Record<string, string> = {
  Perfect: '完好',
  Worn: '磨损',
  In_Maintenance: '维护中',
  Scrapped: '已报废',
};
const CONDITION_COLORS: Record<string, string> = {
  Perfect: 'bg-green-100 text-green-700',
  Worn: 'bg-yellow-100 text-yellow-700',
  In_Maintenance: 'bg-orange-100 text-orange-700',
  Scrapped: 'bg-red-100 text-red-700',
};
const AUTH_LABELS: Record<string, string> = {
  Boxed: '盒装',
  Exclusive: '独家授权',
  One_Of_A_Kind: '绝版',
};

export const AdminScriptCopiesPage: React.FC = () => {
  const [selectedScriptId, setSelectedScriptId] = useState<number | null>(null);
  const [showAddCopy, setShowAddCopy] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [newAuthType, setNewAuthType] = useState('Boxed');

  // 剧本列表
  const { data: scripts, loading, error, refresh } = useDataFetch<Script[]>({
    fetcher: async (_signal) => {
      const data = await getScripts();
      return data as Script[];
    },
  });

  // 选中剧本的副本列表
  const { data: copies, loading: copiesLoading, refresh: refreshCopies } = useDataFetch<ScriptCopy[]>({
    fetcher: async (_signal) => {
      if (!selectedScriptId) return [];
      return getScriptCopies(selectedScriptId);
    },
    refreshInterval: 0,
    deps: [selectedScriptId],
  });

  const { execute: doCreateCopy, loading: creating } = useApiMutation({
    apiFn: (data: Parameters<typeof createScriptCopy>[1]) => createScriptCopy(selectedScriptId!, data),
    successMessage: '剧本副本已创建',
  });

  const selectedScript = (scripts || []).find(s => s.Script_ID === selectedScriptId);
  const copiesList = copies || [];

  const handleAddCopy = async () => {
    if (!selectedScriptId) return;
    if (!newBarcode.trim()) {
      showToast('请输入副本条码', 'warning');
      return;
    }
    await doCreateCopy({
      Copy_Asset_Barcode: newBarcode.trim(),
      Authorization_Type: newAuthType,
      Asset_Condition: 'Perfect',
    });
    setShowAddCopy(false);
    setNewBarcode('');
    setNewAuthType('Boxed');
    refreshCopies();
  };

  const handleConditionChange = async (copyId: number, condition: string) => {
    try {
      await updateCopyCondition(copyId, condition);
      showToast('状态已更新', 'success');
      refreshCopies();
    } catch (err: any) {
      showToast(err?.message || '更新失败', 'error');
    }
  };

  if (loading) return <Loading text="加载剧本列表..." />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const scriptList = scripts || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">剧本副本管理</h2>
          <p className="text-sm text-gray-400 mt-0.5">管理各剧本的实体副本资产（条码、授权类型、状态）</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：剧本列表 */}
        <div className="card lg:col-span-1 max-h-[70vh] overflow-y-auto">
          <h3 className="font-semibold text-gray-900 mb-3">选择剧本</h3>
          {scriptList.length === 0 ? (
            <EmptyState icon="📚" title="暂无剧本" description="请先在系统配置中添加剧本" />
          ) : (
            <div className="space-y-1">
              {scriptList.map(script => (
                <button
                  key={script.Script_ID}
                  onClick={() => {
                    setSelectedScriptId(script.Script_ID);
                    setShowAddCopy(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedScriptId === script.Script_ID
                      ? 'bg-purple-50 border border-purple-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="font-medium text-gray-900 text-sm">{script.Script_Title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {script.Min_Required_Players}-{script.Max_Allowed_Players}人 · ¥{script.Base_Price}/人
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：副本列表 */}
        <div className="card lg:col-span-2 max-h-[70vh] overflow-y-auto">
          {!selectedScriptId ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p>请从左侧选择一个剧本</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {selectedScript?.Script_Title}
                    <span className="text-sm text-gray-400 font-normal ml-2">副本列表</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedScript?.Min_Required_Players}-{selectedScript?.Max_Allowed_Players}人 · {selectedScript?.Estimated_Duration}分钟 · ¥{selectedScript?.Base_Price}/人
                  </p>
                </div>
                <button
                  onClick={() => setShowAddCopy(true)}
                  className="btn-primary text-sm flex items-center gap-1"
                >
                  + 添加副本
                </button>
              </div>

              {/* 添加副本表单 */}
              {showAddCopy && (
                <div className="bg-purple-50 rounded-xl p-4 mb-4 space-y-3">
                  <h4 className="font-medium text-sm text-purple-700">新增剧本副本</h4>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">条码</label>
                    <input
                      type="text"
                      value={newBarcode}
                      onChange={e => setNewBarcode(e.target.value)}
                      placeholder="如：BARCODE-XX-001"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">授权类型</label>
                    <select
                      value={newAuthType}
                      onChange={e => setNewAuthType(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-300"
                    >
                      <option value="Boxed">盒装 (Boxed)</option>
                      <option value="Exclusive">独家授权 (Exclusive)</option>
                      <option value="One_Of_A_Kind">绝版 (One_Of_A_Kind)</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddCopy} disabled={creating} className="btn-primary text-sm flex-1">
                      {creating ? '创建中...' : '确认添加'}
                    </button>
                    <button onClick={() => { setShowAddCopy(false); setNewBarcode(''); }} className="btn-secondary text-sm">
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* 副本列表 */}
              {copiesLoading ? (
                <Loading text="加载副本列表..." />
              ) : copiesList.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="text-sm">该剧本暂无副本</p>
                  {!showAddCopy && (
                    <button onClick={() => setShowAddCopy(true)} className="text-accent-purple text-sm mt-2 hover:underline">
                      添加第一个副本
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {copiesList.map(copy => (
                    <div
                      key={copy.Copy_ID}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-gray-900">#{copy.Copy_ID}</span>
                          <span className="text-xs text-gray-400 font-mono">{copy.Copy_Asset_Barcode}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge text-[12px] ${CONDITION_COLORS[copy.Asset_Condition] || 'bg-gray-100 text-gray-600'}`}>
                            {CONDITION_LABELS[copy.Asset_Condition] || copy.Asset_Condition}
                          </span>
                          <span className="text-xs text-gray-400">{AUTH_LABELS[copy.Authorization_Type] || copy.Authorization_Type}</span>
                          {copy.Current_Storage_Location && (
                            <span className="text-xs text-gray-400">📍 {copy.Current_Storage_Location}</span>
                          )}
                        </div>
                      </div>
                      {/* 快捷状态切换 */}
                      <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                        {['Perfect', 'Worn', 'In_Maintenance', 'Scrapped'].map(cond => (
                          copy.Asset_Condition !== cond && (
                            <button
                              key={cond}
                              onClick={() => handleConditionChange(copy.Copy_ID, cond)}
                              className={`text-[12px] px-2 py-1 rounded-md transition-colors ${
                                CONDITION_COLORS[cond] || 'bg-gray-100 text-gray-600'
                              } hover:opacity-80`}
                              title={`标记为「${CONDITION_LABELS[cond] || cond}」`}
                            >
                              {CONDITION_LABELS[cond] || cond}
                            </button>
                          )
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
