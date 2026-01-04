import React, { useState, useEffect, useCallback } from 'react';
import {
    Users, Activity, Key, Database, TrendingUp, Image,
    MessageSquare, RefreshCw, ArrowLeft, Clock, Zap,
    Shield, AlertTriangle, CheckCircle2, XCircle, Trash2,
    UserCog, Eye, Edit, Crown, KeyRound, Plus
} from 'lucide-react';
import {
    getAdminUsers, getAdminStats, getRecentActivity, getDOPModelStats,
    subscribeToActivity, subscribeToUserActivity, getActiveSessions,
    setUserRole, deleteUser, getFullUserDetails, getAPIKeysOverview,
    setUserAPIKey, deleteUserAPIKey,
    AdminUser, AdminStats
} from '../../utils/adminAPI';

interface AdminDashboardProps {
    onClose: () => void;
    isAdmin: boolean;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose, isAdmin }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'activity' | 'dop' | 'live' | 'keys'>('overview');
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [activity, setActivity] = useState<any[]>([]);
    const [dopStats, setDopStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [realtimeEvents, setRealtimeEvents] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [activeSessions, setActiveSessions] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [apiKeys, setApiKeys] = useState<any[]>([]);

    // Key management modal state
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [keyModalUser, setKeyModalUser] = useState<AdminUser | null>(null);
    const [newKeyType, setNewKeyType] = useState('gemini');
    const [newKeyValue, setNewKeyValue] = useState('');

    // Load data
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, usersData, activityData, dopData, keysData] = await Promise.all([
                getAdminStats(),
                getAdminUsers(),
                getRecentActivity(50),
                getDOPModelStats(),
                getAPIKeysOverview()
            ]);
            setStats(statsData);
            setUsers(usersData);
            setActivity(activityData);
            setDopStats(dopData);
            setApiKeys(keysData);
        } catch (e) {
            console.error('Failed to load admin data:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadData();

        // Subscribe to realtime updates
        const subscription = subscribeToActivity((payload) => {
            setRealtimeEvents(prev => [payload.new, ...prev].slice(0, 10));
            // Refresh activity list
            getRecentActivity(50).then(setActivity);
        });

        // Subscribe to all user activity
        const userActivitySub = subscribeToUserActivity((payload) => {
            setRealtimeEvents(prev => [{
                ...payload.new,
                event_type: payload.event_type,
                timestamp: new Date().toISOString()
            }, ...prev].slice(0, 20));
        });

        // Poll active sessions every 10 seconds
        const sessionInterval = setInterval(() => {
            getActiveSessions().then(setActiveSessions);
        }, 10000);
        getActiveSessions().then(setActiveSessions);

        return () => {
            subscription.unsubscribe();
            userActivitySub.unsubscribe();
            clearInterval(sessionInterval);
        };
    }, [loadData]);

    // Admin actions
    const handleSetAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
        if (!confirm(isCurrentlyAdmin ? 'Remove admin role?' : 'Grant admin role?')) return;
        setActionLoading(userId);
        const success = await setUserRole(userId, isCurrentlyAdmin ? 'user' : 'admin');
        if (success) loadData();
        setActionLoading(null);
    };

    const handleDeleteUser = async (userId: string, email: string) => {
        if (!confirm(`Delete user ${email}? This action cannot be undone.`)) return;
        setActionLoading(userId);
        const success = await deleteUser(userId);
        if (success) loadData();
        setActionLoading(null);
    };

    const handleViewUser = async (user: AdminUser) => {
        setSelectedUser(user);
        // Could load more details here
    };

    // API Key management
    const handleAddKey = async () => {
        if (!keyModalUser || !newKeyValue) return;
        setActionLoading('key');
        const success = await setUserAPIKey(keyModalUser.id, newKeyType, newKeyValue);
        if (success) {
            loadData();
            setShowKeyModal(false);
            setNewKeyValue('');
        }
        setActionLoading(null);
    };

    const handleDeleteKey = async (userId: string, keyType: string) => {
        if (!confirm(`Delete ${keyType} key for this user?`)) return;
        setActionLoading(keyType);
        const success = await deleteUserAPIKey(userId, keyType);
        if (success) loadData();
        setActionLoading(null);
    };

    const openKeyModal = (user: AdminUser) => {
        setKeyModalUser(user);
        setShowKeyModal(true);
    };

    if (!isAdmin) {
        return (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
                <div className="bg-red-900/50 border border-red-500 rounded-xl p-8 text-center">
                    <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                    <p className="text-gray-400">You don't have admin privileges.</p>
                    <button onClick={onClose} className="mt-4 px-6 py-2 bg-gray-700 rounded hover:bg-gray-600">
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-950 z-50 overflow-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Shield className="w-6 h-6 text-purple-500" />
                            Admin Dashboard
                        </h1>
                        <p className="text-sm text-gray-500">Manage users, usage, and API keys</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Realtime indicator */}
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-900/30 border border-green-500/50 rounded-full">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-xs text-green-400">Live</span>
                    </div>
                    <button
                        onClick={loadData}
                        className="p-2 hover:bg-gray-800 rounded"
                        disabled={loading}
                    >
                        <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-800 px-6">
                <div className="flex gap-1">
                    {[
                        { id: 'overview', label: 'Overview', icon: TrendingUp },
                        { id: 'users', label: 'Users', icon: Users },
                        { id: 'keys', label: `API Keys (${apiKeys.length})`, icon: Key },
                        { id: 'live', label: `Live (${activeSessions.length})`, icon: Eye },
                        { id: 'activity', label: 'Activity', icon: Activity },
                        { id: 'dop', label: 'DOP Learning', icon: Database }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-purple-500 text-purple-400'
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && stats && (
                    <div className="space-y-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-4 gap-4">
                            <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="blue" />
                            <StatCard icon={Zap} label="Active (24h)" value={stats.activeUsers24h} color="green" />
                            <StatCard icon={Image} label="Total Images" value={stats.totalImages} color="purple" />
                            <StatCard icon={MessageSquare} label="Text Tokens" value={`${(stats.totalTextTokens / 1000).toFixed(1)}K`} color="yellow" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <StatCard icon={Image} label="Scenes Generated" value={stats.totalScenes} color="cyan" />
                            <StatCard icon={Users} label="Characters Generated" value={stats.totalCharacters} color="pink" />
                        </div>

                        {/* Provider breakdown */}
                        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                            <h3 className="text-lg font-semibold text-white mb-4">Provider Breakdown</h3>
                            <div className="flex gap-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                                    <span className="text-gray-400">Gemini:</span>
                                    <span className="text-white font-bold">{stats.geminiImages.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                                    <span className="text-gray-400">Gommo:</span>
                                    <span className="text-white font-bold">{stats.gommoImages.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="mt-4 h-4 bg-gray-800 rounded-full overflow-hidden flex">
                                <div
                                    className="bg-blue-500 h-full"
                                    style={{ width: `${(stats.geminiImages / (stats.geminiImages + stats.gommoImages) * 100) || 50}%` }}
                                />
                                <div className="bg-yellow-500 h-full flex-1" />
                            </div>
                        </div>

                        {/* Realtime Events */}
                        {realtimeEvents.length > 0 && (
                            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-green-500" />
                                    Live Events
                                </h3>
                                <div className="space-y-2">
                                    {realtimeEvents.map((event, i) => (
                                        <div key={i} className="flex items-center gap-3 text-sm px-3 py-2 bg-gray-800/50 rounded">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            <span className="text-gray-400">{event.generation_type}</span>
                                            <span className="text-gray-500">•</span>
                                            <span className="text-gray-500">{event.model_id}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">User</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Role</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Images</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Scenes</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Characters</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Provider</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Last Activity</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {users.map(user => {
                                    const isUserAdmin = user.email?.includes('admin') || false; // TODO: get from role
                                    const isOnline = activeSessions.some(s => s.user_id === user.id);
                                    return (
                                        <tr key={user.id} className="hover:bg-gray-800/50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                                                            {user.email?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        {isOnline && (
                                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="text-white block">{user.email}</span>
                                                        {user.display_name && <span className="text-gray-500 text-xs">{user.display_name}</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {isUserAdmin ? (
                                                    <span className="px-2 py-1 bg-purple-900/50 text-purple-400 text-xs rounded flex items-center gap-1 w-fit">
                                                        <Crown className="w-3 h-3" /> Admin
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded">User</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-white font-mono">{user.total_images}</td>
                                            <td className="px-4 py-3 text-cyan-400 font-mono">{user.scenes_generated}</td>
                                            <td className="px-4 py-3 text-pink-400 font-mono">{user.characters_generated}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 text-xs rounded">
                                                        G:{user.gemini_images}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-400 text-xs rounded">
                                                        Go:{user.gommo_images}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-sm">
                                                {user.last_activity ? new Date(user.last_activity).toLocaleString('vi-VN') : 'Never'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={() => handleViewUser(user)}
                                                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleSetAdmin(user.id, isUserAdmin)}
                                                        className={`p-1.5 rounded ${isUserAdmin ? 'hover:bg-purple-900/50 text-purple-400' : 'hover:bg-gray-700 text-gray-400 hover:text-purple-400'}`}
                                                        title={isUserAdmin ? 'Remove Admin' : 'Make Admin'}
                                                        disabled={actionLoading === user.id}
                                                    >
                                                        <Crown className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id, user.email)}
                                                        className="p-1.5 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400"
                                                        title="Delete User"
                                                        disabled={actionLoading === user.id}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Live Sessions Tab */}
                {activeTab === 'live' && (
                    <div className="space-y-6">
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Eye className="w-5 h-5 text-green-500" />
                                Active Users (Last 5 minutes)
                                <span className="ml-2 px-2 py-0.5 bg-green-900/50 text-green-400 text-sm rounded">{activeSessions.length}</span>
                            </h3>
                            {activeSessions.length === 0 ? (
                                <p className="text-gray-500">No active users right now</p>
                            ) : (
                                <div className="space-y-3">
                                    {activeSessions.map((session, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                                                        {session.user_id?.slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse"></div>
                                                </div>
                                                <div>
                                                    <p className="text-white font-mono text-sm">{session.user_id?.slice(0, 16)}...</p>
                                                    <p className="text-gray-500 text-xs">{session.actions?.length || 0} actions</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-gray-400 text-sm">Last: {new Date(session.last_activity).toLocaleTimeString('vi-VN')}</p>
                                                <div className="flex gap-1 mt-1">
                                                    {session.actions?.slice(0, 3).map((action: any, j: number) => (
                                                        <span key={j} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                                                            {action.mode}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Realtime Event Stream */}
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-purple-500" />
                                Live Event Stream
                            </h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {realtimeEvents.map((event, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded text-sm">
                                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                        <span className="text-gray-500">{new Date(event.timestamp || event.created_at).toLocaleTimeString('vi-VN')}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${event.event_type === 'image_generated' ? 'bg-purple-900/50 text-purple-400' : 'bg-cyan-900/50 text-cyan-400'
                                            }`}>
                                            {event.event_type || event.generation_type}
                                        </span>
                                        <span className="text-gray-400 truncate">{event.model_id || event.model_type}</span>
                                    </div>
                                ))}
                                {realtimeEvents.length === 0 && (
                                    <p className="text-gray-500">Waiting for events...</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Activity Tab */}
                {activeTab === 'activity' && (
                    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Time</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Type</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Model</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Resolution</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Aspect Ratio</th>
                                    <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Project</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {activity.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-800/50">
                                        <td className="px-4 py-3 text-gray-400 text-sm">
                                            {new Date(item.created_at).toLocaleString('vi-VN')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs ${item.generation_type === 'scene' ? 'bg-cyan-900/50 text-cyan-400' :
                                                item.generation_type === 'character' ? 'bg-pink-900/50 text-pink-400' :
                                                    'bg-gray-700 text-gray-400'
                                                }`}>
                                                {item.generation_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-white text-sm font-mono">
                                            {item.model_id?.slice(0, 20)}...
                                        </td>
                                        <td className="px-4 py-3 text-gray-400 text-sm">{item.resolution}</td>
                                        <td className="px-4 py-3 text-gray-400 text-sm">{item.aspect_ratio}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-32">
                                            {item.project_id}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* DOP Learning Tab */}
                {activeTab === 'dop' && (
                    <div className="space-y-6">
                        {/* Model Performance Table */}
                        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                            <div className="p-4 border-b border-gray-800">
                                <h3 className="text-lg font-semibold text-white">📊 Model Performance</h3>
                                <p className="text-sm text-gray-500">DOP tracks performance per model to optimize prompts</p>
                            </div>
                            <table className="w-full">
                                <thead className="bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Model</th>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Generations</th>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Approved</th>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Rejected</th>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Approval Rate</th>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Avg Quality</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {dopStats.map((model, i) => {
                                        const rejectedCount = (model.total_generations || 0) - (model.approved_count || 0);
                                        return (
                                            <tr key={i} className="hover:bg-gray-800/50">
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-sm font-mono ${model.model_type?.includes('gemini') ? 'bg-blue-900/50 text-blue-400' :
                                                        model.model_type?.includes('imagen') ? 'bg-green-900/50 text-green-400' :
                                                            'bg-yellow-900/50 text-yellow-400'
                                                        }`}>
                                                        {model.model_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-white font-mono">
                                                    {model.total_generations?.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-green-400 font-mono">
                                                    ✅ {model.approved_count?.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-red-400 font-mono">
                                                    ❌ {rejectedCount}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full ${(model.approval_rate || 0) > 0.7 ? 'bg-green-500' : (model.approval_rate || 0) > 0.4 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                                style={{ width: `${(model.approval_rate || 0) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-gray-400 text-sm">
                                                            {((model.approval_rate || 0) * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-yellow-400 font-mono">
                                                    ⭐ {(model.avg_quality_score || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Rejection Breakdown */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                    Rejection Reasons (Top)
                                </h3>
                                <div className="space-y-3">
                                    {dopStats.length > 0 && dopStats[0]?.rejection_counts ? (
                                        Object.entries(dopStats[0].rejection_counts)
                                            .sort((a: any, b: any) => b[1] - a[1])
                                            .slice(0, 8)
                                            .map(([reason, count]: any) => (
                                                <div key={reason} className="flex items-center justify-between">
                                                    <span className="text-gray-300 text-sm">
                                                        {reason === 'raccord_error' ? '🔗 Sai Raccord' :
                                                            reason === 'character_mismatch' ? '👤 Nhân vật sai' :
                                                                reason === 'wrong_outfit' ? '👔 Sai trang phục' :
                                                                    reason === 'wrong_lighting' ? '💡 Sai ánh sáng' :
                                                                        reason === 'wrong_background' ? '🏞️ Sai background' :
                                                                            reason === 'quality_issue' ? '📉 Chất lượng' :
                                                                                reason}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-red-900/50 text-red-400 text-xs rounded font-mono">
                                                        {count}
                                                    </span>
                                                </div>
                                            ))
                                    ) : (
                                        <p className="text-gray-500 text-sm">Chưa có rejection data</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                                    Successful Patterns (Top)
                                </h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {dopStats.length > 0 && dopStats[0]?.successful_patterns ? (
                                        dopStats[0].successful_patterns.slice(0, 10).map((pattern: string, i: number) => (
                                            <span key={i} className="inline-block px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded mr-2 mb-1">
                                                {pattern}
                                            </span>
                                        ))
                                    ) : (
                                        <p className="text-gray-500 text-sm">DOP sẽ học patterns từ approved prompts</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* How DOP Uses Knowledge */}
                        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-500/30 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">🧠 Cách DOP Vận Dụng Kiến Thức</h3>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="bg-black/30 rounded-lg p-4">
                                    <h4 className="text-purple-400 font-semibold mb-2">1️⃣ Thu thập Data</h4>
                                    <ul className="text-gray-400 space-y-1">
                                        <li>• Track mỗi generation</li>
                                        <li>• Record prompt + keywords</li>
                                        <li>• Lưu approval/rejection</li>
                                    </ul>
                                </div>
                                <div className="bg-black/30 rounded-lg p-4">
                                    <h4 className="text-blue-400 font-semibold mb-2">2️⃣ Phân Tích Pattern</h4>
                                    <ul className="text-gray-400 space-y-1">
                                        <li>• Keywords nào → Approved?</li>
                                        <li>• Keywords nào → Rejected?</li>
                                        <li>• Model nào tốt với gì?</li>
                                    </ul>
                                </div>
                                <div className="bg-black/30 rounded-lg p-4">
                                    <h4 className="text-green-400 font-semibold mb-2">3️⃣ Áp Dụng</h4>
                                    <ul className="text-gray-400 space-y-1">
                                        <li>• Ưu tiên successful patterns</li>
                                        <li>• Tránh failure patterns</li>
                                        <li>• Chọn model phù hợp</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* API Keys Tab */}
                {activeTab === 'keys' && (
                    <div className="space-y-6">
                        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                        <Key className="w-5 h-5 text-yellow-400" />
                                        User API Keys
                                    </h3>
                                    <p className="text-sm text-gray-500">Manage API keys assigned to users</p>
                                </div>
                            </div>
                            <table className="w-full">
                                <thead className="bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">User</th>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Key Type</th>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Preview</th>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Created</th>
                                        <th className="px-4 py-3 text-left text-xs text-gray-400 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {apiKeys.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                                No API keys found. Keys are stored when users add them in their profile.
                                            </td>
                                        </tr>
                                    ) : (
                                        apiKeys.map((key, i) => (
                                            <tr key={i} className="hover:bg-gray-800/50">
                                                <td className="px-4 py-3 text-white text-sm">
                                                    {key.email}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-mono ${key.key_type === 'gemini' ? 'bg-blue-900/50 text-blue-400' :
                                                        key.key_type === 'gommo' ? 'bg-yellow-900/50 text-yellow-400' :
                                                            'bg-gray-700 text-gray-300'
                                                        }`}>
                                                        {key.key_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-mono text-gray-400 text-sm">
                                                    {key.key_preview || '***...***'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-400 text-sm">
                                                    {new Date(key.created_at).toLocaleDateString('vi-VN')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => handleDeleteKey(key.user_id, key.key_type)}
                                                        disabled={actionLoading === key.key_type}
                                                        className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                                        title="Delete key"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Users without keys */}
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-green-400" />
                                Assign API Key to User
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Users with existing keys can have them updated. Users without keys are highlighted.
                            </p>
                            <div className="grid grid-cols-4 gap-4">
                                {users
                                    .filter(u => u.role !== 'deleted')
                                    .slice(0, 12)
                                    .map(user => {
                                        const userKeys = apiKeys.filter(k => k.user_id === user.id);
                                        const hasKey = userKeys.length > 0;
                                        return (
                                            <button
                                                key={user.id}
                                                onClick={() => openKeyModal(user)}
                                                className={`p-4 rounded-lg transition-colors text-left ${hasKey
                                                    ? 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                                                    : 'bg-yellow-900/20 hover:bg-yellow-900/40 border border-yellow-500/30'
                                                    }`}
                                            >
                                                <p className="text-white text-sm font-medium truncate">{user.email}</p>
                                                <p className={`text-xs mt-1 ${hasKey ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    {hasKey
                                                        ? `✅ ${userKeys.map(k => k.key_type).join(', ')}`
                                                        : '⚠️ No API key'}
                                                </p>
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Key Modal */}
                {showKeyModal && keyModalUser && (
                    <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center" onClick={() => setShowKeyModal(false)}>
                        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-semibold text-white mb-4">
                                Add API Key for {keyModalUser.email}
                            </h3>

                            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-3 mb-4">
                                <p className="text-blue-300 text-xs">
                                    <strong>ℹ️ Note:</strong> Gemini keys work immediately.
                                    Gommo requires domain + access token (set in User Profile).
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Key Type</label>
                                    <select
                                        value={newKeyType}
                                        onChange={e => setNewKeyType(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                                    >
                                        <option value="gemini">🔵 Gemini API Key (Most Used)</option>
                                        <option value="gommo">🟡 Gommo Token (Requires Domain)</option>
                                        <option value="openai">🟢 OpenAI API Key</option>
                                        <option value="anthropic">🟣 Anthropic API Key</option>
                                    </select>
                                    {newKeyType === 'gommo' && (
                                        <p className="text-yellow-400 text-xs mt-1">
                                            ⚠️ For Gommo, you need both Domain AND Access Token.
                                            Use User Profile modal for full Gommo setup.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">
                                        {newKeyType === 'gemini' ? 'Gemini API Key (AIza...)' :
                                            newKeyType === 'gommo' ? 'Gommo Access Token' :
                                                newKeyType === 'openai' ? 'OpenAI API Key (sk-...)' :
                                                    'Anthropic API Key'}
                                    </label>
                                    <input
                                        type="password"
                                        value={newKeyValue}
                                        onChange={e => setNewKeyValue(e.target.value)}
                                        placeholder={
                                            newKeyType === 'gemini' ? 'AIza...' :
                                                newKeyType === 'gommo' ? 'Paste access token...' :
                                                    newKeyType === 'openai' ? 'sk-...' :
                                                        'sk-ant-...'
                                        }
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono text-sm"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAddKey}
                                        disabled={!newKeyValue || actionLoading === 'key'}
                                        className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 
                                            text-white rounded-lg font-medium transition-colors"
                                    >
                                        {actionLoading === 'key' ? 'Saving...' : 'Save Key'}
                                    </button>
                                    <button
                                        onClick={() => setShowKeyModal(false)}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard: React.FC<{
    icon: any;
    label: string;
    value: number | string;
    color: 'blue' | 'green' | 'purple' | 'yellow' | 'cyan' | 'pink';
}> = ({ icon: Icon, label, value, color }) => {
    const colors = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-green-600',
        purple: 'from-purple-500 to-purple-600',
        yellow: 'from-yellow-500 to-yellow-600',
        cyan: 'from-cyan-500 to-cyan-600',
        pink: 'from-pink-500 to-pink-600',
    };

    return (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 hover:border-gray-700 transition-colors">
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-gray-500 text-sm">{label}</p>
                    <p className="text-2xl font-bold text-white">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
