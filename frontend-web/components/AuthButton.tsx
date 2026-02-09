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
			const { data: { user }, error } = await supabase.auth.getUser();
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
		return <div className="h-9 w-20 bg-white/10 animate-pulse rounded-lg"></div>;
	}

	if (user) {
		return (
			<div className="flex items-center gap-3">
				<span className="text-white/80 text-sm hidden sm:block">
					{user.email}
				</span>
				<button
					onClick={handleSignOut}
					className="px-3 py-1.5 text-xs font-medium text-white/90 bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/10"
				>
					Logout
				</button>
			</div>
		);
	}

	return (
		<Link
			href="/login"
			className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
		>
			Accedi
		</Link>
	);
}
