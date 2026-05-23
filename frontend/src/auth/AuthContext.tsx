import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, AuthUser } from '../api/client';

const USE_AMPLIFY = import.meta.env.VITE_USE_AMPLIFY === 'true';

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = USE_AMPLIFY ? loadAmplifyUser : loadLocalUser;
    load()
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const u = USE_AMPLIFY ? await amplifyLogin(email, password) : await localLogin(email, password);
    setUser(u);
  };

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    if (USE_AMPLIFY) {
      await amplifySignup(email, password, firstName, lastName);
    } else {
      await api.post('/auth/signup', { email, password, firstName, lastName });
    }
  };

  const logout = async () => {
    if (USE_AMPLIFY) {
      await amplifyLogout();
    } else {
      localStorage.removeItem('token');
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ---- Local backend (Express + JSON store) ----

async function loadLocalUser(): Promise<AuthUser | null> {
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const { user } = await api.get<{ user: AuthUser }>('/auth/me');
    return user;
  } catch {
    localStorage.removeItem('token');
    return null;
  }
}

async function localLogin(email: string, password: string): Promise<AuthUser> {
  const { token, user } = await api.post<{ token: string; user: AuthUser }>(
    '/auth/login',
    { email, password }
  );
  localStorage.setItem('token', token);
  return user;
}

// ---- AWS Cognito via Amplify v6 ----

async function loadAmplifyUser(): Promise<AuthUser | null> {
  const { getCurrentUser, fetchUserAttributes, fetchAuthSession } = await import('aws-amplify/auth');
  try {
    const current = await getCurrentUser();
    const attrs = await fetchUserAttributes();
    const session = await fetchAuthSession();
    const groupsClaim = session.tokens?.idToken?.payload['cognito:groups'];
    const groups = Array.isArray(groupsClaim) ? (groupsClaim as string[]) : [];
    // Prefer given_name + family_name (new signups); fall back to name for
    // legacy users created before the split.
    const composed = [attrs.given_name, attrs.family_name]
      .filter((v): v is string => !!v && v.trim().length > 0)
      .join(' ')
      .trim();
    return {
      userId: current.userId,
      email: attrs.email ?? '',
      name: composed || attrs.name || '',
      role: groups.includes('admin') ? 'admin' : 'member',
    };
  } catch {
    return null;
  }
}

async function amplifyLogin(email: string, password: string): Promise<AuthUser> {
  const { signIn } = await import('aws-amplify/auth');
  try {
    const result = await signIn({ username: email, password });
    if (!result.isSignedIn) {
      throw new Error(`Additional sign-in step required: ${result.nextStep.signInStep}`);
    }
  } catch (e) {
    // Cognito throws UserNotConfirmedException while a user is awaiting admin approval.
    if (e && typeof e === 'object' && 'name' in e && e.name === 'UserNotConfirmedException') {
      throw new Error('Account not yet approved by admin');
    }
    throw e;
  }
  const u = await loadAmplifyUser();
  if (!u) throw new Error('Signed in, but session could not be loaded');
  return u;
}

async function amplifySignup(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<void> {
  const { signUp } = await import('aws-amplify/auth');
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  await signUp({
    username: email,
    password,
    options: {
      // `name` (Cognito `name`) is required on the pool; given/family are
      // optional but populated for new signups so display can prefer them.
      userAttributes: {
        email,
        name: fullName,
        given_name: firstName.trim(),
        family_name: lastName.trim(),
      },
    },
  });
}

async function amplifyLogout(): Promise<void> {
  const { signOut } = await import('aws-amplify/auth');
  await signOut();
}
