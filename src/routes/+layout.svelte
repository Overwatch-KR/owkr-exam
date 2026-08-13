<script lang="ts">
	import { browser } from '$app/environment';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import '../app.css';

	let { children } = $props();
	const queryClient = new QueryClient({
		defaultOptions: { queries: { enabled: browser, refetchOnWindowFocus: false } }
	});
</script>

<svelte:head
	><title>OWKR 관리자 선발 시험</title>
	<meta name="description" content="OWKR 관리자 선발 시험" />
</svelte:head>
<QueryClientProvider client={queryClient}>{@render children()}</QueryClientProvider>
