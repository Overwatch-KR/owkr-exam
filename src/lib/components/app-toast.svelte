<script lang="ts">
	let {
		toast,
		dismiss
	}: {
		toast: { tone: 'success' | 'error'; message: string } | null;
		dismiss: () => void;
	} = $props();

	const title = $derived(toast?.tone === 'error' ? '처리하지 못했습니다' : '처리되었습니다');
</script>

{#if toast}
	<div
		class="pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-5 sm:justify-end"
	>
		<div
			class="pointer-events-auto flex w-full max-w-md items-start gap-3 border-l-4 bg-white px-4 py-3 shadow-lg"
			class:border-l-[#087ba8]={toast.tone === 'success'}
			class:border-l-red-700={toast.tone === 'error'}
			role={toast.tone === 'error' ? 'alert' : 'status'}
		>
			<div class="min-w-0 flex-1">
				<p
					class="text-[11px] font-bold tracking-wide"
					class:text-[#087ba8]={toast.tone === 'success'}
					class:text-red-700={toast.tone === 'error'}
				>
					{title}
				</p>
				<p class="mt-0.5 text-sm leading-6 font-semibold text-[#34404d]">{toast.message}</p>
			</div>
			<button
				type="button"
				class="-mt-1 -mr-1 h-7 w-7 text-lg leading-none text-[#6a7684] hover:text-[#34404d]"
				onclick={dismiss}
				aria-label="알림 닫기">×</button
			>
		</div>
	</div>
{/if}
