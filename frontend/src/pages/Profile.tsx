import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Loader2, Shield, Save, KeyRound } from 'lucide-react'; 
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

// Traducteur de rôle technique en Libellé lisible en Français
function roleLabel(role: string) {
  switch (role) {
    case 'ROLE_ADMIN': return 'Administrateur';
    case 'ROLE_EVENT_CREATOR': return 'Organisateur';
    default: return 'Utilisateur'; // ROLE_USER
  }
}

export default function Profile() {
  const { user, login, token } = useAuth(); // Récupère le contexte
  const { toast, showToast, hideToast } = useToast(); // Allumeur de Toast

  //  ÉTATS LOCAUX DU FORMULAIRE
  const [profileForm, setProfileForm] = useState({ // Infos de base
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
  });
  const [passwordForm, setPasswordForm] = useState({ // Sécurité
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Sauvegarde les modifications apportées au profil (Prénom/Nom)
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    
    try {
      // Appel PATCH /users/me sur la Gateway
      const response = await api.patch('/users/me', {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
      });

      if (token && user) {
        // MAJ itérative du contexte global pour que la Navbar s'actualise
        login(token, { ...user, ...response.data }); 
      }
      showToast('Profil mis à jour avec succès !', 'success');
    } catch {
      showToast('Erreur lors de la mise à jour du profil.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Sauvegarde le changement de mot de passe
  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validations client-side basiques
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('Les mots de passe ne correspondent pas.', 'error');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showToast('Le mot de passe doit contenir au moins 8 caractères.', 'error');
      return;
    }
    
    setSavingPassword(true);
    
    try {
      // Appel PATCH /users/me/password
      await api.patch('/users/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      // Purge du formulaire après succès
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Mot de passe modifié avec succès !', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Erreur lors du changement de mot de passe.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return ( // Rendu Principal
    <div className="max-w-xl mx-auto space-y-8 animate-fade-in">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* EN-TÊTE  */}
      <div className="border-b border-noir-800 pb-6">
        <div className="label-sol mb-2">Compte</div>
        <h1 className="font-display font-semibold text-3xl text-noir-50">Mon Profil</h1>
        <p className="text-noir-400 text-sm mt-1 font-sans">
          Gérez vos informations personnelles et votre sécurité.
        </p>
      </div>

      {/* BLOC CARTE IDENTITÉ DE L'UTILISATEUR */}
      <div className="card-dark p-5 flex items-center gap-4">
        {/* Avatar logo première lettre */}
        <div
          className="w-14 h-14 rounded-sm bg-sol flex items-center justify-center text-noir-950 font-display font-bold text-2xl flex-shrink-0"
          style={{ boxShadow: '0 0 20px rgba(232,167,48,0.2)' }}
        >
          {user?.firstName?.[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-xl text-noir-50 truncate">
            {user?.firstName} {user?.lastName}
          </div>
          <div className="text-sm font-mono text-noir-400 truncate">{user?.email}</div>
        </div>
        {/* Liste des badges de Rôles attachés */}
        <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
          {user?.roles?.map((role) => (
            <span
              key={role}
              className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-noir-800 border border-noir-700 text-noir-300"
            >
              <Shield className="w-2.5 h-2.5 text-sol" /> {roleLabel(role)}
            </span>
          ))}
        </div>
      </div>

      {/* FORMULAIRE INFOS PERSONNELLES */}
      <div className="card-dark p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-sm bg-noir-800 border border-noir-700 flex items-center justify-center">
            <Save className="w-3.5 h-3.5 text-sol" />
          </div>
          <div className="font-sans font-semibold text-noir-100 text-sm">Informations personnelles</div>
        </div>

        <form onSubmit={handleProfileSave} className="space-y-4"> {/* Envoi */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-dim block mb-2">Prénom</label>
              <input
                type="text" required value={profileForm.firstName}
                onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                className="input-dark"
              />
            </div>
            <div>
              <label className="label-dim block mb-2">Nom</label>
              <input
                type="text" required value={profileForm.lastName}
                onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                className="input-dark"
              />
            </div>
          </div>
          <div>
            <label className="label-dim block mb-2">Email</label>
            <input
              type="email" disabled value={profileForm.email} // Bloqué en édition
              className="input-dark opacity-40 cursor-not-allowed"
            />
            <p className="text-xs font-mono text-noir-500 mt-1.5">L'adresse email ne peut pas être modifiée.</p>
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={savingProfile} className="btn-sol">
              {savingProfile
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sauvegarde...</>
                : <><Save className="w-3.5 h-3.5" /> Enregistrer</>
              }
            </button>
          </div>
        </form>
      </div>

      {/* FORMULAIRE CHANGEMENT MDP */}
      <div className="card-dark p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-sm bg-noir-800 border border-noir-700 flex items-center justify-center">
            <KeyRound className="w-3.5 h-3.5 text-sol" />
          </div>
          <div className="font-sans font-semibold text-noir-100 text-sm">Changer le mot de passe</div>
        </div>

        <form onSubmit={handlePasswordSave} className="space-y-4"> {/* Envoi */}
          <div>
            <label className="label-dim block mb-2">Mot de passe actuel</label>
            <input
              type="password" required value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="input-dark" autoComplete="current-password"
            />
          </div>
          <div>
            <label className="label-dim block mb-2">Nouveau mot de passe</label>
            <input
              type="password" required minLength={8} value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="input-dark" autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label-dim block mb-2">Confirmer le nouveau mot de passe</label>
            <input
              type="password" required minLength={8} value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="input-dark" autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={savingPassword} className="btn-ghost">
              {savingPassword
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Modification...</>
                : <><KeyRound className="w-3.5 h-3.5" /> Modifier le mot de passe</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  ); 
}
