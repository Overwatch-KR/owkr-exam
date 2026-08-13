<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from '$lib/components/ui/sonner';
	import '../app.css';

	let { children } = $props();
	let pageLoading = $state(false);

	beforeNavigate(() => {
		pageLoading = true;
	});

	afterNavigate(() => {
		pageLoading = false;
	});
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				enabled: browser,
				refetchOnWindowFocus: false,
				staleTime: 5 * 60_000,
				gcTime: 15 * 60_000
			}
		}
	});
</script>

<svelte:head
	><title>OWKR 관리자 선발 시험</title>
	<meta name="description" content="OWKR 관리자 선발 시험" />
</svelte:head>
<QueryClientProvider client={queryClient}>
	<Toaster />
	{@render children()}
</QueryClientProvider>
{#if pageLoading}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-[#087ba8]"
		aria-hidden="true"
	></div>
{/if}
