'use client';

import { createClient } from '@/lib/supabase/client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DynamicBackground from '@/components/DynamicBackground';

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
		} catch (err: any) {
			setError(err.message || 'Si è verificato un errore');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="relative z-10 w-full max-w-md glass p-8 rounded-2xl shadow-2xl">
			<div className="text-center mb-8">
				<Link href="/" className="inline-block">
					<h1 className="text-3xl font-bold text-white tracking-tight mb-2">Smart Meteo</h1>
				</Link>
				<p className="text-white/60">
					{mode === 'signin' ? 'Bentornato! Accedi al tuo account.' : 'Crea un nuovo account.'}
				</p>
			</div>

			<form onSubmit={handleAuth} className="space-y-4">
				<div>
					<label className="block text-sm font-medium text-white/80 mb-1">Email</label>
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
						className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
						placeholder="tuo@email.com"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-white/80 mb-1">Password</label>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						minLength={6}
						className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
						placeholder="••••••••"
					/>
				</div>

				{error && (
					<div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
						{error}
					</div>
				)}

				{message && (
					<div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-200 text-sm">
						{message}
					</div>
				)}

				<button
					type="submit"
					disabled={loading}
					className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
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
					className="text-white/60 hover:text-white text-sm transition-colors"
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
		<div className="relative min-h-screen flex items-center justify-center p-4">
			{/* Background statico o dinamico di default */}
			<DynamicBackground condition="clear" />
			<Suspense fallback={<div className="glass p-8 rounded-2xl text-white">Caricamento...</div>}>
				<LoginForm />
			</Suspense>
		</div>
	);
}
