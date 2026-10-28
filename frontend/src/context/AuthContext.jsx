import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getCurrentIdentity,
  enterAnonymously as apiEnter,
  createAdditionalIdentity as apiCreateIdentity,
  switchActiveIdentity as apiSwitchIdentity,
  deleteIdentity as apiDeleteIdentity,
  rotateIdentity as apiRotate,
  leaveSession as apiLeave
} from '../services/api.js';
import CreateIdentityModal from '../components/CreateIdentityModal.jsx';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(null);
  const [identities, setIdentities] = useState([]);
  const [maxIdentities] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalConfig, setCreateModalConfig] = useState({ reason: '', onSuccess: null });

  useEffect(() => {
    checkCurrentSession();
  }, []);

  async function checkCurrentSession() {
    try {
      setIsLoading(true);
      const res = await getCurrentIdentity();
      if (res.success && res.identity) {
        setIdentity(res.identity);
        setIdentities(res.identities || [res.identity]);
      } else {
        setIdentity(null);
        setIdentities([]);
      }
    } catch {
      setIdentity(null);
      setIdentities([]);
    } finally {
      setIsLoading(false);
    }
  }

  function openCreateModal(options = {}) {
    const reason = typeof options === 'string' ? options : (options?.reason || '');
    const onSuccess = typeof options === 'function' ? options : (options?.onSuccess || null);
    setCreateModalConfig({ reason, onSuccess });
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setCreateModalConfig({ reason: '', onSuccess: null });
  }

  async function handleModalSubmit(bio = '') {
    try {
      setIsCreating(true);
      const newIdent = await createIdentity(bio);
      const cb = createModalConfig.onSuccess;
      closeCreateModal();
      if (cb) {
        cb(newIdent);
      }
      return newIdent;
    } finally {
      setIsCreating(false);
    }
  }

  async function enter() {
    // Delegates to explicit identity creation without automatic ghost sessions
    return await createIdentity();
  }

  async function createIdentity(bio = '') {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiCreateIdentity(bio);
      if (res.success && res.identity) {
        setIdentity(res.identity);
        setIdentities(res.identities || [res.identity]);
        return res.identity;
      }
    } catch (err) {
      setError(err.message || 'Failed to create new identity.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function switchIdentity(identityId) {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiSwitchIdentity(identityId);
      if (res.success && res.identity) {
        setIdentity(res.identity);
        setIdentities(res.identities || []);
        return res.identity;
      }
    } catch (err) {
      setError(err.message || 'Failed to switch identity.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function removeIdentity(identityId, { deleteMessages = false } = {}) {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiDeleteIdentity(identityId, { deleteMessages });
      if (res.success) {
        // Permanently purge local AI well-being chat history associated with this identity
        try {
          localStorage.removeItem(`anon_ai_chat_${identityId}`);
          if (!res.identity && (!res.identities || res.identities.length === 0)) {
            localStorage.removeItem('anon_ai_chat_guest');
          }
        } catch (storageErr) {
          console.error('Failed to clear AI chat from localStorage:', storageErr);
        }

        setIdentity(res.identity || null);
        setIdentities(res.identities || []);
        return res;
      }
    } catch (err) {
      setError(err.message || 'Failed to remove identity.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function rotate() {
    if (identities.length < 5) {
      return await createIdentity();
    }
    const err = new Error('You have reached the maximum of 5 identities. Consciously remove an existing identity first to create a new one.');
    setError(err.message);
    throw err;
  }

  async function leave() {
    try {
      await apiLeave();
    } finally {
      setIdentity(null);
      setIdentities([]);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        identity,
        identities,
        maxIdentities,
        canCreateMore: identities.length < maxIdentities,
        isAuthenticated: !!identity,
        isLoading,
        error,
        enter,
        createIdentity,
        openCreateModal,
        closeCreateModal,
        isCreateModalOpen,
        switchIdentity,
        removeIdentity,
        rotate,
        leave,
        refresh: checkCurrentSession
      }}
    >
      {children}
      <CreateIdentityModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onSubmitCreate={handleModalSubmit}
        isCreating={isCreating}
        reason={createModalConfig.reason}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
