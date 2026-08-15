'use client';

import { createClient } from '@/lib/supabase/client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [mode, setMode] = useState<'signin' | 'signup'>('signin');
	const [message, setMessage] = useState<string | null>(null);

	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectTo = searchParams.get('redirect') || '/';
	const supabase = createClient();

	const handleAuth = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setMessage(null);

		try {
			if (mode === 'signup') {
				const { error } = await supabase.auth.signUp({
					email,
					password,
					options: {
						emailRedirectTo: `${location.origin}/auth/callback`,
					},
				});
				if (error) throw error;
				setMessage('Controlla la tua email per confermare la registrazione.');
			} else {
				const { error } = await supabase.auth.signInWithPassword({
					email,
					password,
				});
				if (error) throw error;
				router.push(redirectTo);
				router.refresh();
			}
		} catch (err: unknown) {
			const errorMessage = err instanceof Error ? err.message : 'Si è verificato un errore';
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="relative z-10 w-full max-w-md glass-strong p-8" style={{ color: 'var(--color-duet-ink)' }}>
			<div className="text-center mb-8">
				<Link href="/" className="inline-block">
					<h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: 'var(--color-duet-ink)' }}>Smart Meteo</h1>
				</Link>
				<p style={{ color: 'var(--color-duet-muted)' }}>
					{mode === 'signin' ? 'Bentornato! Accedi al tuo account.' : 'Crea un nuovo account.'}
				</p>
			</div>

			<form onSubmit={handleAuth} className="space-y-4">
				<div>
					<label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-duet-ink-soft)' }}>Email</label>
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						className="dt-input w-full px-4 py-2 rounded-lg outline-none"
						style={{ background: 'var(--color-duet-surface)', border: '1px solid var(--color-duet-border-strong)', color: 'var(--color-duet-ink)' }}
						placeholder="tuo@email.com"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-duet-ink-soft)' }}>Password</label>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						minLength={6}
						className="dt-input w-full px-4 py-2 rounded-lg outline-none"
						style={{ background: 'var(--color-duet-surface)', border: '1px solid var(--color-duet-border-strong)', color: 'var(--color-duet-ink)' }}
						placeholder="••••••••"
					/>
				</div>

				{error && (
					<div className="p-3 rounded-lg text-sm" style={{ background: '#fde8e8', border: '1px solid #f3b4b4', color: '#8c2323' }}>
						{error}
					</div>
				)}

				{message && (
					<div className="p-3 rounded-lg text-sm" style={{ background: 'var(--color-duet-green-bg)', border: '1px solid #b6e3cc', color: 'var(--color-duet-green-ink)' }}>
						{message}
					</div>
				)}

				<button
					type="submit"
					disabled={loading}
					className="dt-primary w-full py-3 px-4 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					style={{ background: 'var(--color-duet-accent)' }}
				>
					{loading ? 'Elaborazione...' : mode === 'signin' ? 'Accedi' : 'Registrati'}
				</button>
			</form>

			<div className="mt-6 text-center">
				<button
					onClick={() => {
						setMode(mode === 'signin' ? 'signup' : 'signin');
						setError(null);
						setMessage(null);
					}}
					className="text-sm transition-colors"
					style={{ color: 'var(--color-duet-muted)' }}
				>
					{mode === 'signin'
						? 'Non hai un account? Registrati'
						: 'Hai già un account? Accedi'}
				</button>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<div className="relative min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-duet-bg)' }}>
			<Suspense fallback={<div className="glass p-8" style={{ color: 'var(--color-duet-ink)' }}>Caricamento...</div>}>
				<LoginForm />
			</Suspense>
		</div>
	);
}
