'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

export default function AuthButton() {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const router = useRouter();
	const supabase = createClient();

	useEffect(() => {
		const getUser = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				setUser(user);
			}
			setLoading(false);
		};

		getUser();

		const { data: { subscription } } = supabase.auth.onAuthStateChange(
			(_event, session) => {
				setUser(session?.user ?? null);
			}
		);

		return () => {
			subscription.unsubscribe();
		};
	}, [supabase]);

	const handleSignOut = async () => {
		await supabase.auth.signOut();
		router.refresh();
	};

	if (loading) {
		return <div className="h-9 w-20 rounded-lg animate-pulse" style={{ background: 'var(--color-duet-bg)' }}></div>;
	}

	if (user) {
		return (
			<div className="flex items-center gap-3">
				<span className="text-sm hidden sm:block" style={{ color: 'var(--color-duet-ink-soft)' }}>
					{user.email}
				</span>
				<button
					onClick={handleSignOut}
					className="dt-secondary px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
					style={{ background: 'var(--color-duet-surface)', border: '1px solid var(--color-duet-border-strong)', color: 'var(--color-duet-accent)' }}
				>
					Logout
				</button>
			</div>
		);
	}

	return (
		<Link
			href="/login"
			className="dt-primary px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
			style={{ background: 'var(--color-duet-accent)' }}
		>
			Accedi
		</Link>
	);
}
