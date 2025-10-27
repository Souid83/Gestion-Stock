import React, { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Edit2, Mail, Shield, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ROLES, type Role } from '../../lib/rbac';

interface UserProfile {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', role: ROLES.MAGASIN });

  console.log('[UsersManagement] Component mounted');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    console.log('[UsersManagement] Loading users...');
    setIsLoading(true);
    setError(null);

    try {
      // Récupérer tous les profils avec leurs emails
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, role, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('[UsersManagement] Error loading profiles:', profilesError);
        throw profilesError;
      }

      console.log('[UsersManagement] Profiles loaded:', profiles?.length);

      // Récupérer les informations d'authentification pour chaque utilisateur
      const usersWithEmails: UserProfile[] = [];

      for (const profile of profiles || []) {
        try {
          const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(profile.id);

          if (!userError && user) {
            usersWithEmails.push({
              id: profile.id,
              email: user.email || 'Email non disponible',
              role: profile.role as Role,
              created_at: profile.created_at
            });
          } else {
            console.warn('[UsersManagement] Could not load user details for:', profile.id);
          }
        } catch (err) {
          console.warn('[UsersManagement] Error loading user:', profile.id, err);
        }
      }

      console.log('[UsersManagement] Users with emails:', usersWithEmails.length);
      setUsers(usersWithEmails);
    } catch (err: any) {
      console.error('[UsersManagement] Error loading users:', err);
      setError(err.message || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[UsersManagement] Creating user:', { email: formData.email, role: formData.role });
    setError(null);

    try {
      // Créer l'utilisateur via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: formData.role
          }
        }
      });

      if (authError) {
        console.error('[UsersManagement] Auth error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Utilisateur non créé');
      }

      console.log('[UsersManagement] User created in auth:', authData.user.id);

      // Créer le profil avec le rôle
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          role: formData.role
        });

      if (profileError) {
        console.error('[UsersManagement] Profile error:', profileError);
        throw profileError;
      }

      console.log('[UsersManagement] Profile created successfully');

      // Réinitialiser le formulaire et recharger la liste
      setFormData({ email: '', password: '', role: ROLES.MAGASIN });
      setShowAddModal(false);
      await loadUsers();
    } catch (err: any) {
      console.error('[UsersManagement] Error creating user:', err);
      setError(err.message || 'Erreur lors de la création de l\'utilisateur');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    console.log('[UsersManagement] Updating role for user:', userId, 'to', newRole);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (updateError) {
        console.error('[UsersManagement] Error updating role:', updateError);
        throw updateError;
      }

      console.log('[UsersManagement] Role updated successfully');
      setEditingUserId(null);
      await loadUsers();
    } catch (err: any) {
      console.error('[UsersManagement] Error updating role:', err);
      setError(err.message || 'Erreur lors de la mise à jour du rôle');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }

    console.log('[UsersManagement] Deleting user:', userId);
    setError(null);

    try {
      // Supprimer le profil (auth sera géré par RLS/triggers)
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        console.error('[UsersManagement] Error deleting user:', deleteError);
        throw deleteError;
      }

      console.log('[UsersManagement] User deleted successfully');
      await loadUsers();
    } catch (err: any) {
      console.error('[UsersManagement] Error deleting user:', err);
      setError(err.message || 'Erreur lors de la suppression de l\'utilisateur');
    }
  };

  const getRoleLabel = (role: Role): string => {
    switch (role) {
      case ROLES.ADMIN_FULL:
        return 'Administrateur Complet';
      case ROLES.ADMIN:
        return 'Administrateur';
      case ROLES.MAGASIN:
        return 'Magasin';
      case ROLES.COMMANDE:
        return 'Commande';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: Role): string => {
    switch (role) {
      case ROLES.ADMIN_FULL:
        return 'bg-purple-100 text-purple-800';
      case ROLES.ADMIN:
        return 'bg-blue-100 text-blue-800';
      case ROLES.MAGASIN:
        return 'bg-green-100 text-green-800';
      case ROLES.COMMANDE:
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-blue-600" />
                <h1 className="text-2xl font-semibold text-gray-900">Gestion des Utilisateurs</h1>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                Ajouter un utilisateur
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Mail size={16} />
                      Email
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Shield size={16} />
                      Rôle
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date de création
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.email}</div>
                      <div className="text-xs text-gray-500">{user.id.substring(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateRole(user.id, e.target.value as Role)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value={ROLES.ADMIN_FULL}>Administrateur Complet</option>
                            <option value={ROLES.ADMIN}>Administrateur</option>
                            <option value={ROLES.MAGASIN}>Magasin</option>
                            <option value={ROLES.COMMANDE}>Commande</option>
                          </select>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingUserId(user.id)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Modifier le rôle"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Supprimer l'utilisateur"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Aucun utilisateur trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Nouvel Utilisateur</h2>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="utilisateur@exemple.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Au moins 6 caractères"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={ROLES.ADMIN_FULL}>Administrateur Complet</option>
                    <option value={ROLES.ADMIN}>Administrateur</option>
                    <option value={ROLES.MAGASIN}>Magasin</option>
                    <option value={ROLES.COMMANDE}>Commande</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setFormData({ email: '', password: '', role: ROLES.MAGASIN });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Créer
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
