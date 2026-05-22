import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Signup() {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password, name);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-sm mx-auto card p-7 text-center">
        <h1 className="text-2xl font-semibold mb-2">Thanks!</h1>
        <p className="text-woodland-muted">
          Your signup is awaiting admin approval. You&apos;ll be able to log in once approved.
        </p>
        <Link to="/login" className="inline-block mt-5 text-woodland-primary hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto card p-7">
      <h1 className="text-2xl font-semibold mb-5">Create an account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-woodland-muted">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-woodland-muted">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-woodland-muted">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="input"
          />
        </div>
        {error && <p className="text-sm text-woodland-danger">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Submitting…' : 'Sign up'}
        </button>
        <p className="text-sm text-woodland-muted text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-woodland-primary hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
