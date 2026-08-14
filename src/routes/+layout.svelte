<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { page, updated } from '$app/state';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { Toaster } from '$lib/components/ui/sonner';
	import '../app.css';

	let { children } = $props();
	let pageLoading = $state(false);
	let updateDismissed = $state(false);
	let updateAvailable = $derived(
		updated.current && page.url.pathname !== '/exam' && !updateDismissed
	);

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
{#if updateAvailable}
	<aside
		class="fixed right-4 bottom-4 z-[70] w-[calc(100%-2rem)] max-w-sm border border-[#d8e0e8] bg-white p-4 shadow-[0_12px_28px_rgba(17,24,32,0.16)]"
		role="status"
		aria-live="polite"
	>
		<p class="text-sm font-semibold text-[#111820]">새 버전이 준비되었습니다.</p>
		<p class="mt-1 text-sm leading-5 text-[#667788]">
			현재 작업을 마친 뒤 새로고침하면 최신 버전을 사용할 수 있습니다.
		</p>
		<div class="mt-4 flex justify-end gap-2">
			<button
				class="btn-secondary h-9 px-3 text-sm"
				type="button"
				onclick={() => (updateDismissed = true)}
			>
				나중에
			</button>
			<button class="btn h-9 px-3 text-sm" type="button" onclick={() => window.location.reload()}>
				새로고침
			</button>
		</div>
	</aside>
{/if}
{#if pageLoading}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 bg-[#087ba8]"
		aria-hidden="true"
	></div>
{/if}
